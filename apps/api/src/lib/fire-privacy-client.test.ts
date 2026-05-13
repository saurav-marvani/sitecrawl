import http from "http";
import { AddressInfo } from "net";
import { config } from "../config";
import { redactText } from "./fire-privacy-client";

type Handler = (
  req: http.IncomingMessage,
  res: http.ServerResponse,
) => void | Promise<void>;

let server: http.Server;
let baseUrl: string;
let originalUrl: string;
let handler: Handler = (_req, res) => {
  res.statusCode = 500;
  res.end();
};

beforeAll(async () => {
  await new Promise<void>(resolve => {
    server = http.createServer((req, res) => {
      void Promise.resolve(handler(req, res)).catch(err => {
        res.statusCode = 500;
        res.end(String(err));
      });
    });
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address() as AddressInfo;
      baseUrl = `http://127.0.0.1:${addr.port}`;
      originalUrl = config.FIRE_PRIVACY_URL;
      config.FIRE_PRIVACY_URL = baseUrl;
      resolve();
    });
  });
});

afterAll(async () => {
  config.FIRE_PRIVACY_URL = originalUrl;
  await new Promise<void>(resolve => server.close(() => resolve()));
});

afterEach(() => {
  handler = (_req, res) => {
    res.statusCode = 500;
    res.end();
  };
});

function withBody(body: unknown, status = 200): Handler {
  return (_req, res) => {
    res.statusCode = status;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(body));
  };
}

describe("redactText", () => {
  it("returns status=ok with redacted_text and spans on 200", async () => {
    handler = withBody({
      redacted_text: "Hi, my name is <PERSON>.",
      spans: [
        {
          start: 15,
          end: 26,
          kind: "PERSON",
          score: 0.9,
          source: "SpacyRecognizer",
        },
      ],
      model_status: "ok",
      model_truncated_at: null,
    });

    const out = await redactText({ text: "Hi, my name is Alice Smith." });

    expect(out.status).toBe("ok");
    expect(out.redactedMarkdown).toBe("Hi, my name is <PERSON>.");
    expect(out.spans).toHaveLength(1);
    expect(out.spans[0].kind).toBe("PERSON");
    expect(out.truncatedAt).toBeNull();
  });

  it("treats absent model_status as ok", async () => {
    handler = withBody({
      redacted_text: "redacted",
      spans: [],
    });

    const out = await redactText({ text: "input" });
    expect(out.status).toBe("ok");
    expect(out.redactedMarkdown).toBe("redacted");
  });

  it("passes through truncatedAt when set", async () => {
    handler = withBody({
      redacted_text: "...",
      spans: [],
      model_truncated_at: 32000,
    });

    const out = await redactText({ text: "input" });
    expect(out.truncatedAt).toBe(32000);
  });

  it("returns status=skipped when model_status is skipped", async () => {
    handler = withBody({
      redacted_text: "",
      spans: [],
      model_status: "skipped",
    });

    const out = await redactText({ text: "input-not-empty" });
    expect(out.status).toBe("skipped");
    expect(out.redactedMarkdown).toBe("");
  });

  it("short-circuits empty input to skipped without an HTTP call", async () => {
    let called = false;
    handler = (_req, res) => {
      called = true;
      res.statusCode = 500;
      res.end();
    };

    const out = await redactText({ text: "   \n\t" });
    expect(called).toBe(false);
    expect(out.status).toBe("skipped");
    expect(out.redactedMarkdown).toBe("   \n\t");
    expect(out.spans).toEqual([]);
  });

  it("maps 503 to service_at_capacity, success-with-null-markdown", async () => {
    handler = (_req, res) => {
      res.statusCode = 503;
      res.end();
    };

    const out = await redactText({ text: "input" });
    expect(out.status).toBe("service_at_capacity");
    expect(out.redactedMarkdown).toBeNull();
    expect(out.spans).toEqual([]);
  });

  it("maps 413 (input too large) to error", async () => {
    handler = (_req, res) => {
      res.statusCode = 413;
      res.end();
    };

    const out = await redactText({ text: "input" });
    expect(out.status).toBe("error");
    expect(out.redactedMarkdown).toBeNull();
  });

  it("maps generic 5xx to error", async () => {
    handler = (_req, res) => {
      res.statusCode = 502;
      res.end();
    };

    const out = await redactText({ text: "input" });
    expect(out.status).toBe("error");
    expect(out.redactedMarkdown).toBeNull();
  });

  it("returns status=error when model_status is error", async () => {
    handler = withBody({
      redacted_text: "anything",
      spans: [],
      model_status: "error",
    });

    const out = await redactText({ text: "input" });
    expect(out.status).toBe("error");
    expect(out.redactedMarkdown).toBeNull();
  });

  it("returns timeout when fire-privacy exceeds the budget", async () => {
    handler = (_req, res) => {
      // Hang past the timeout.
      setTimeout(() => {
        res.statusCode = 200;
        res.end(
          JSON.stringify({
            redacted_text: "late",
            spans: [],
            model_status: "ok",
          }),
        );
      }, 200);
    };

    const out = await redactText({ text: "input", timeoutMs: 50 });
    expect(out.status).toBe("timeout");
    expect(out.redactedMarkdown).toBeNull();
  });

  it("returns error when the URL is unreachable", async () => {
    const originalLocalUrl = config.FIRE_PRIVACY_URL;
    config.FIRE_PRIVACY_URL = "http://127.0.0.1:1";
    try {
      const out = await redactText({ text: "input", timeoutMs: 500 });
      expect(out.status).toBe("error");
      expect(out.redactedMarkdown).toBeNull();
    } finally {
      config.FIRE_PRIVACY_URL = originalLocalUrl;
    }
  });

  it("returns error on invalid JSON response", async () => {
    handler = (_req, res) => {
      res.statusCode = 200;
      res.setHeader("content-type", "application/json");
      res.end("{not json");
    };

    const out = await redactText({ text: "input" });
    expect(out.status).toBe("error");
    expect(out.redactedMarkdown).toBeNull();
  });

  it("filters malformed spans", async () => {
    handler = withBody({
      redacted_text: "redacted",
      spans: [
        { start: 0, end: 5, kind: "PERSON", score: 0.9, source: "x" },
        { start: "bad", end: 5, kind: "PERSON" },
        null,
        { start: 10, end: 15, kind: "EMAIL_ADDRESS" },
      ],
    });

    const out = await redactText({ text: "input" });
    expect(out.spans).toHaveLength(2);
    expect(out.spans[0].kind).toBe("PERSON");
    expect(out.spans[1].kind).toBe("EMAIL_ADDRESS");
    expect(out.spans[1].score).toBe(0);
    expect(out.spans[1].source).toBe("unknown");
  });

  it("sends mode/operator/language defaults", async () => {
    let captured: Record<string, unknown> | undefined;
    handler = async (req, res) => {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk as Buffer);
      captured = JSON.parse(Buffer.concat(chunks).toString());
      res.statusCode = 200;
      res.setHeader("content-type", "application/json");
      res.end(
        JSON.stringify({ redacted_text: "ok", spans: [], model_status: "ok" }),
      );
    };

    await redactText({ text: "input" });
    expect(captured).toMatchObject({
      text: "input",
      mode: "model",
      operator: "replace",
      language: "en",
    });
  });
});
