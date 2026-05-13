import { Logger } from "winston";
import { config } from "../config";
import { PIIBlock, PIIStatus, PIISpan } from "../controllers/v2/types";

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
};

const DEFAULTS = Object.freeze({
  mode: "model" as const,
  operator: "replace" as const,
  language: "en" as const,
});

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

export async function redactText(opts: RedactOptions): Promise<PIIBlock> {
  const { text, logger } = opts;
  const timeoutMs = opts.timeoutMs ?? config.FIRE_PRIVACY_TIMEOUT_MS;

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
        text,
        mode: DEFAULTS.mode,
        operator: DEFAULTS.operator,
        language: DEFAULTS.language,
      }),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    const status: PIIStatus = timedOut ? "timeout" : "error";
    logger?.warn("fire-privacy request failed", {
      status,
      url: opts.url,
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      status,
      redactedMarkdown: null,
      spans: [],
      truncatedAt: null,
    };
  }
  clearTimeout(timer);

  if (!response.ok) {
    let status: PIIStatus;
    if (response.status === 503) status = "service_at_capacity";
    else status = "error";
    logger?.warn("fire-privacy returned non-2xx", {
      status,
      httpStatus: response.status,
      url: opts.url,
    });
    return {
      status,
      redactedMarkdown: null,
      spans: [],
      truncatedAt: null,
    };
  }

  let body: FirePrivacyResponse;
  try {
    body = (await response.json()) as FirePrivacyResponse;
  } catch (err) {
    logger?.warn("fire-privacy returned invalid JSON", {
      url: opts.url,
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      status: "error",
      redactedMarkdown: null,
      spans: [],
      truncatedAt: null,
    };
  }

  const modelStatus = statusFromModelStatus(body.model_status);
  const redactedMarkdown =
    typeof body.redacted_text === "string" ? body.redacted_text : null;
  const spans = coerceSpans(body.spans);
  const truncatedAt =
    typeof body.model_truncated_at === "number"
      ? body.model_truncated_at
      : null;

  if (modelStatus === "error" || redactedMarkdown === null) {
    return {
      status: "error",
      redactedMarkdown: null,
      spans,
      truncatedAt,
    };
  }

  return {
    status: modelStatus,
    redactedMarkdown,
    spans,
    truncatedAt,
  };
}
