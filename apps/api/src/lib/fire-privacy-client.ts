import { Logger } from "winston";
import { config } from "../config";
import {
  PIIBlock,
  PIIStatus,
  PIISpan,
  RedactPIIOptions,
  type RedactPIIEntity,
} from "../controllers/v2/types";
import { chunkMarkdown, type Chunk } from "./fire-privacy-chunker";

type FirePrivacyResponse = {
  redacted_text?: unknown;
  spans?: unknown;
  model_status?: unknown;
  model_truncated_at?: unknown;
};

type RedactOptions = {
  text: string;
  url?: string;
  timeoutMs?: number;
  logger?: Logger;
  // Caller-provided config. Boolean form is normalized to a defaults
  // object via the Zod transform before reaching here; an unset value
  // wouldn't trigger this code path at all (transformer skips when
  // meta.options.redactPII is falsy).
  options?: RedactPIIOptions;
};

// Mode + replaceStyle map to fire-privacy's `mode` and `operator` fields.
// Keep both sides in sync if either side changes.
const MODE_MAP = {
  accurate: "model",
  aggressive: "both",
  fast: "heuristics",
} as const;

const REPLACE_MAP = {
  tag: "replace",
  mask: "mask",
  remove: "redact",
} as const;

const DEFAULTS = {
  mode: "accurate",
  replaceStyle: "tag",
  language: "en",
} as const;

// Hard ceiling: above this byte count we refuse to redact and return
// `skipped_too_large` rather than ship partial results. Sized from
// `eval/scaling/` measurements in fire-privacy: 250KB ≈ ~80 PDF pages,
// ~10 chunks, ~60s wall at c=3 with the model on. Anything larger
// pushes past the typical scrape budget and starves the fleet.
const MAX_REDACT_BYTES = 250_000;
// Chunks fan out at this concurrency to fire-privacy. The fleet has 6
// pods at saturation; c=3 keeps a single call under 50% of capacity so
// other tenants aren't starved.
const CHUNK_CONCURRENCY = 3;

// Maps a span's `kind` (as returned by either OPF or Presidio) onto the
// unified entity bucket we expose to callers. Kinds we don't recognize
// fall through unmapped — entity filtering treats them as "not in any
// bucket" and drops them when an entity allowlist is in play.
const KIND_TO_ENTITY: Record<string, RedactPIIEntity> = {
  // Person
  PRIVATE_PERSON: "PERSON",
  PERSON: "PERSON",
  // Email
  PRIVATE_EMAIL: "EMAIL",
  EMAIL_ADDRESS: "EMAIL",
  // Phone
  PRIVATE_PHONE: "PHONE",
  PHONE_NUMBER: "PHONE",
  PHONEIMEI: "PHONE",
  // Location
  PRIVATE_ADDRESS: "LOCATION",
  LOCATION: "LOCATION",
  // Financial
  ACCOUNT_NUMBER: "FINANCIAL",
  CREDIT_CARD: "FINANCIAL",
  IBAN_CODE: "FINANCIAL",
  US_BANK_NUMBER: "FINANCIAL",
  US_SSN: "FINANCIAL",
  US_ITIN: "FINANCIAL",
  CRYPTO: "FINANCIAL",
  // Secret
  SECRET: "SECRET",
  API_KEY: "SECRET",
  PASSWORD: "SECRET",
  US_DRIVER_LICENSE: "SECRET",
  US_PASSPORT: "SECRET",
  MEDICAL_LICENSE: "SECRET",
};

function coerceSpans(value: unknown): PIISpan[] {
  if (!Array.isArray(value)) return [];
  const out: PIISpan[] = [];
  for (const raw of value) {
    if (typeof raw !== "object" || raw === null) continue;
    const r = raw as Record<string, unknown>;
    if (
      typeof r.start !== "number" ||
      typeof r.end !== "number" ||
      typeof r.kind !== "string"
    ) {
      continue;
    }
    out.push({
      start: r.start,
      end: r.end,
      kind: r.kind,
      score: typeof r.score === "number" ? r.score : 0,
      source: typeof r.source === "string" ? r.source : "unknown",
    });
  }
  return out;
}

function statusFromModelStatus(value: unknown): PIIStatus {
  // Per the API contract: on 200, derive status from `model_status` when
  // present. "skipped" and "error" map directly. Anything else — including
  // "ok", "disabled", or an absent field — means redaction succeeded.
  if (value === "skipped") return "skipped";
  if (value === "error") return "error";
  return "ok";
}

// Apply an entity allowlist to the span set. When unset, returns the
// spans unchanged. When set, keeps only spans whose `kind` maps onto
// one of the requested entities — unmapped kinds drop.
function filterByEntities(
  spans: PIISpan[],
  entities: readonly RedactPIIEntity[] | undefined,
): PIISpan[] {
  if (!entities || entities.length === 0) return spans;
  const allow = new Set(entities);
  return spans.filter(span => {
    const bucket = KIND_TO_ENTITY[span.kind];
    return bucket !== undefined && allow.has(bucket);
  });
}

// Re-render redacted text from the original + a filtered span set when
// fire-privacy's `redacted_text` no longer matches what we want to return
// (i.e. we narrowed the spans via entity filter). Same operator semantics
// as fire-privacy:
//   tag    → `<KIND>` placeholder per span
//   mask   → '*' × span length
//   remove → drop the chars entirely
function renderRedacted(
  text: string,
  spans: PIISpan[],
  replaceStyle: RedactPIIOptions["replaceStyle"],
): string {
  if (spans.length === 0) return text;
  const sorted = [...spans].sort((a, b) => a.start - b.start);
  let out = "";
  let cursor = 0;
  for (const span of sorted) {
    if (span.start < cursor) continue; // overlap with prior span; skip
    if (span.start > text.length) break;
    out += text.slice(cursor, span.start);
    switch (replaceStyle) {
      case "tag":
        out += `<${span.kind}>`;
        break;
      case "mask":
        out += "*".repeat(Math.max(0, span.end - span.start));
        break;
      case "remove":
        break;
    }
    cursor = Math.min(span.end, text.length);
  }
  out += text.slice(cursor);
  return out;
}

// Result of one /redact call, in source-coordinate space (spans already
// offset by the chunk's start).
type ChunkResult =
  | {
      ok: true;
      spans: PIISpan[];
      redactedText: string;
      // Sticky status across chunks: "ok" unless an individual chunk
      // model errored (we surface that on the merged block).
      modelStatus: PIIStatus;
      truncatedAt: number | null;
    }
  | { ok: false; status: PIIStatus };

async function redactOnce(
  chunk: Chunk,
  options: RedactPIIOptions,
  url: string | undefined,
  timeoutMs: number,
  logger: Logger | undefined,
): Promise<ChunkResult> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  let response: Response;
  try {
    response = await fetch(`${config.FIRE_PRIVACY_URL}/redact`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: chunk.text,
        mode: MODE_MAP[options.mode],
        operator: REPLACE_MAP[options.replaceStyle],
        language: DEFAULTS.language,
      }),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    const status: PIIStatus = timedOut ? "timeout" : "error";
    logger?.warn("fire-privacy request failed", {
      status,
      url,
      mode: options.mode,
      chunkStart: chunk.start,
      error: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, status };
  }
  clearTimeout(timer);

  if (!response.ok) {
    const status: PIIStatus =
      response.status === 503 ? "service_at_capacity" : "error";
    logger?.warn("fire-privacy returned non-2xx", {
      status,
      httpStatus: response.status,
      url,
      mode: options.mode,
      chunkStart: chunk.start,
    });
    return { ok: false, status };
  }

  let body: FirePrivacyResponse;
  try {
    body = (await response.json()) as FirePrivacyResponse;
  } catch (err) {
    logger?.warn("fire-privacy returned invalid JSON", {
      url,
      chunkStart: chunk.start,
      error: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, status: "error" };
  }

  const modelStatus = statusFromModelStatus(body.model_status);
  const upstreamRedacted =
    typeof body.redacted_text === "string" ? body.redacted_text : null;
  const rawSpans = coerceSpans(body.spans);
  const truncatedAt =
    typeof body.model_truncated_at === "number"
      ? body.model_truncated_at + chunk.start
      : null;

  if (modelStatus === "error" || upstreamRedacted === null) {
    return { ok: false, status: "error" };
  }

  // Lift spans into source coordinates.
  const spans = rawSpans.map(s => ({
    ...s,
    start: s.start + chunk.start,
    end: s.end + chunk.start,
  }));

  return {
    ok: true,
    spans,
    redactedText: upstreamRedacted,
    modelStatus,
    truncatedAt,
  };
}

// Run chunks against fire-privacy with bounded concurrency. Returns
// results in chunk order (results[i] corresponds to chunks[i]).
async function runChunks(
  chunks: Chunk[],
  options: RedactPIIOptions,
  url: string | undefined,
  timeoutMs: number,
  logger: Logger | undefined,
): Promise<ChunkResult[]> {
  const results = new Array<ChunkResult>(chunks.length);
  let next = 0;

  const worker = async (): Promise<void> => {
    while (true) {
      const i = next++;
      if (i >= chunks.length) return;
      results[i] = await redactOnce(chunks[i], options, url, timeoutMs, logger);
    }
  };

  const workers = Array.from(
    { length: Math.min(CHUNK_CONCURRENCY, chunks.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}

export async function redactText(opts: RedactOptions): Promise<PIIBlock> {
  const { text, logger } = opts;
  const timeoutMs = opts.timeoutMs ?? config.FIRE_PRIVACY_TIMEOUT_MS;
  const options: RedactPIIOptions = opts.options ?? {
    mode: DEFAULTS.mode,
    replaceStyle: DEFAULTS.replaceStyle,
  };

  // Empty/whitespace input is a no-op locally — saves a round trip and matches
  // fire-privacy's own "skipped" semantics.
  if (text.trim().length === 0) {
    return {
      status: "skipped",
      redactedMarkdown: text,
      spans: [],
      truncatedAt: null,
    };
  }

  // Hard byte ceiling. Anything above this is refused with a dedicated
  // status so callers can tell "we declined" apart from "we tried and
  // it broke." We measure bytes, not chars, because fire-privacy's
  // request cap is byte-based.
  const inputBytes = new TextEncoder().encode(text).length;
  if (inputBytes > MAX_REDACT_BYTES) {
    logger?.info("fire-privacy input exceeds redaction ceiling", {
      url: opts.url,
      inputBytes,
      maxBytes: MAX_REDACT_BYTES,
    });
    return {
      status: "skipped_too_large",
      redactedMarkdown: null,
      spans: [],
      truncatedAt: null,
    };
  }

  const chunks = chunkMarkdown(text);
  const results = await runChunks(chunks, options, opts.url, timeoutMs, logger);

  // All-or-nothing: any chunk failure poisons the whole response. Partial
  // redaction is worse than no redaction — callers can't tell which
  // sections of their markdown are clean. Pick the first non-ok status
  // so the failure surface (timeout / service_at_capacity / error) is
  // preserved end-to-end.
  const firstFailure = results.find(r => !r.ok);
  if (firstFailure && !firstFailure.ok) {
    return {
      status: firstFailure.status,
      redactedMarkdown: null,
      spans: [],
      truncatedAt: null,
    };
  }

  const successes = results.filter(
    (r): r is Extract<ChunkResult, { ok: true }> => r.ok,
  );

  // Merge: spans already lifted into source coordinates by redactOnce.
  const allSpans = successes.flatMap(r => r.spans);
  // truncatedAt: surface the first chunk that reported truncation. With
  // chunks ≤28K chars (below fire-privacy's 32K model window), this
  // should be null in practice.
  const truncatedAt =
    successes.find(r => r.truncatedAt !== null)?.truncatedAt ?? null;

  // Status: pass through model-side status from the first chunk. If any
  // chunk's model said "skipped", we surface that; otherwise "ok".
  const status: PIIStatus =
    successes.find(r => r.modelStatus === "skipped")?.modelStatus ?? "ok";

  const spans = filterByEntities(allSpans, options.entities);
  // Re-render when the entity filter pruned spans OR when we have
  // multiple chunks (per-chunk redacted_text concatenations are valid
  // since chunks are non-overlapping, but re-rendering with the same
  // operator yields identical output and keeps one code path for the
  // edge cases — e.g. chunk boundaries inside a span are impossible
  // by construction since spans are produced after we split).
  const concatRedacted = successes.map(r => r.redactedText).join("");
  const redactedMarkdown =
    spans.length === allSpans.length
      ? concatRedacted
      : renderRedacted(text, spans, options.replaceStyle);

  return {
    status,
    redactedMarkdown,
    spans,
    truncatedAt,
  };
}
