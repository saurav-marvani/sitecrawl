import { describe, expect, it } from "vitest";
import { searchRequestSchema } from "./types";

describe("searchRequestSchema highlights", () => {
  it("enables highlights by default", () => {
    const request = searchRequestSchema.parse({ query: "firecrawl" });

    expect(request.highlights).toBe(true);
  });

  it("allows highlights to be disabled explicitly", () => {
    const request = searchRequestSchema.parse({
      query: "firecrawl",
      highlights: false,
    });

    expect(request.highlights).toBe(false);
  });
});
