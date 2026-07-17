/**
 * Minimal unit test for v2 scrape (no mocking; sanity check payload path)
 */
import { SitecrawlClient } from "../../../v2/client";

describe("v2.scrape unit", () => {
  test("constructor requires apiKey", () => {
    expect(() => new SitecrawlClient({ apiKey: "", apiUrl: "https://api.sitecrawl.dev" })).toThrow();
  });
});

