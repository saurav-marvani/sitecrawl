import { Sitecrawl, SitecrawlClient } from "../../../index";

describe("V2 prototype discoverability", () => {
  const app = new Sitecrawl({ apiKey: "fc-test", apiUrl: "http://localhost:9" });

  it("exposes V2 methods on immediate Sitecrawl prototype", () => {
    const names = Object.getOwnPropertyNames(Object.getPrototypeOf(app));

    expect(names).toEqual(
      expect.arrayContaining([
        "scrape",
        "search",
        "map",
        "crawl",
        "startCrawl",
        "getCrawlStatus",
        "batchScrape",
        "v1",
      ])
    );
  });

  it("preserves v1 getter on Sitecrawl prototype", () => {
    const desc = Object.getOwnPropertyDescriptor(
      Object.getPrototypeOf(app),
      "v1"
    );
    expect(desc).toBeDefined();
    expect(desc!.get).toBeDefined();
  });

  it("copied descriptors are identical to V2 prototype originals", () => {
    for (const name of ["scrape", "search", "crawl", "map", "startCrawl"]) {
      const sitecrawlDesc = Object.getOwnPropertyDescriptor(Sitecrawl.prototype, name);
      const v2Desc = Object.getOwnPropertyDescriptor(SitecrawlClient.prototype, name);
      expect(sitecrawlDesc).toBeDefined();
      expect(sitecrawlDesc!.value).toBe(v2Desc!.value);
    }
  });

  it("copied method resolves this to the Sitecrawl instance", async () => {
    const method = Object.getOwnPropertyDescriptor(Sitecrawl.prototype, "scrape")!.value;
    await expect(method.call(app, "https://example.com")).rejects.toThrow();
  });
});
