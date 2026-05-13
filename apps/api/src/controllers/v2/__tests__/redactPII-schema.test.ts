import { scrapeRequestSchema } from "../types";

describe("v2 scrapeRequestSchema — redactPII", () => {
  const baseUrl = "https://example.com";

  it("accepts redactPII: true with `pii` in formats", () => {
    const result = scrapeRequestSchema.safeParse({
      url: baseUrl,
      formats: ["markdown", "pii"],
      redactPII: true,
    });
    expect(result.success).toBe(true);
  });

  it("accepts redactPII: false with `pii` in formats", () => {
    const result = scrapeRequestSchema.safeParse({
      url: baseUrl,
      formats: ["markdown", "pii"],
      redactPII: false,
    });
    expect(result.success).toBe(true);
  });

  it("accepts redactPII unset (defaults to false)", () => {
    const result = scrapeRequestSchema.safeParse({
      url: baseUrl,
      formats: ["markdown"],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.redactPII).toBe(false);
    }
  });

  it("rejects redactPII: true without `pii` in formats", () => {
    const result = scrapeRequestSchema.safeParse({
      url: baseUrl,
      formats: ["markdown"],
      redactPII: true,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map(i => i.message).join("\n");
      expect(messages).toMatch(/redactPII requires `pii`/);
    }
  });

  it("rejects redactPII as a string", () => {
    const result = scrapeRequestSchema.safeParse({
      url: baseUrl,
      formats: ["markdown", "pii"],
      redactPII: "yes",
    });
    expect(result.success).toBe(false);
  });

  it("rejects redactPII as an object", () => {
    const result = scrapeRequestSchema.safeParse({
      url: baseUrl,
      formats: ["markdown", "pii"],
      redactPII: { mode: "model" },
    });
    expect(result.success).toBe(false);
  });

  it("accepts `pii` as a string format", () => {
    const result = scrapeRequestSchema.safeParse({
      url: baseUrl,
      formats: ["pii"],
    });
    expect(result.success).toBe(true);
  });

  it("accepts `pii` as an object format", () => {
    const result = scrapeRequestSchema.safeParse({
      url: baseUrl,
      formats: [{ type: "pii" }],
    });
    expect(result.success).toBe(true);
  });
});
