import { generateURLPermutations } from "./crawl-redis";

describe("generateURLPermutations", () => {
  it("generates permutations correctly", () => {
    const bareHttps = generateURLPermutations("https://sitecrawl.dev").map(
      x => x.href,
    );
    expect(bareHttps.length).toBe(16);
    expect(bareHttps.includes("https://sitecrawl.dev/")).toBe(true);
    expect(bareHttps.includes("https://sitecrawl.dev/index.html")).toBe(true);
    expect(bareHttps.includes("https://sitecrawl.dev/index.php")).toBe(true);
    expect(bareHttps.includes("https://www.sitecrawl.dev/")).toBe(true);
    expect(bareHttps.includes("https://www.sitecrawl.dev/index.html")).toBe(
      true,
    );
    expect(bareHttps.includes("https://www.sitecrawl.dev/index.php")).toBe(
      true,
    );
    expect(bareHttps.includes("http://sitecrawl.dev/")).toBe(true);
    expect(bareHttps.includes("http://sitecrawl.dev/index.html")).toBe(true);
    expect(bareHttps.includes("http://sitecrawl.dev/index.php")).toBe(true);
    expect(bareHttps.includes("http://www.sitecrawl.dev/")).toBe(true);
    expect(bareHttps.includes("http://www.sitecrawl.dev/index.html")).toBe(
      true,
    );
    expect(bareHttps.includes("http://www.sitecrawl.dev/index.php")).toBe(true);

    const bareHttp = generateURLPermutations("http://sitecrawl.dev").map(
      x => x.href,
    );
    expect(bareHttp.length).toBe(16);
    expect(bareHttp.includes("https://sitecrawl.dev/")).toBe(true);
    expect(bareHttp.includes("https://sitecrawl.dev/index.html")).toBe(true);
    expect(bareHttp.includes("https://sitecrawl.dev/index.php")).toBe(true);
    expect(bareHttp.includes("https://www.sitecrawl.dev/")).toBe(true);
    expect(bareHttp.includes("https://www.sitecrawl.dev/index.html")).toBe(
      true,
    );
    expect(bareHttp.includes("https://www.sitecrawl.dev/index.php")).toBe(true);
    expect(bareHttp.includes("http://sitecrawl.dev/")).toBe(true);
    expect(bareHttp.includes("http://sitecrawl.dev/index.html")).toBe(true);
    expect(bareHttp.includes("http://sitecrawl.dev/index.php")).toBe(true);
    expect(bareHttp.includes("http://www.sitecrawl.dev/")).toBe(true);
    expect(bareHttp.includes("http://www.sitecrawl.dev/index.html")).toBe(true);
    expect(bareHttp.includes("http://www.sitecrawl.dev/index.php")).toBe(true);

    const wwwHttps = generateURLPermutations("https://www.sitecrawl.dev").map(
      x => x.href,
    );
    expect(wwwHttps.length).toBe(16);
    expect(wwwHttps.includes("https://sitecrawl.dev/")).toBe(true);
    expect(wwwHttps.includes("https://sitecrawl.dev/index.html")).toBe(true);
    expect(wwwHttps.includes("https://sitecrawl.dev/index.php")).toBe(true);
    expect(wwwHttps.includes("https://www.sitecrawl.dev/")).toBe(true);
    expect(wwwHttps.includes("https://www.sitecrawl.dev/index.html")).toBe(
      true,
    );
    expect(wwwHttps.includes("https://www.sitecrawl.dev/index.php")).toBe(true);
    expect(wwwHttps.includes("http://sitecrawl.dev/")).toBe(true);
    expect(wwwHttps.includes("http://sitecrawl.dev/index.html")).toBe(true);
    expect(wwwHttps.includes("http://sitecrawl.dev/index.php")).toBe(true);
    expect(wwwHttps.includes("http://www.sitecrawl.dev/")).toBe(true);
    expect(wwwHttps.includes("http://www.sitecrawl.dev/index.html")).toBe(true);
    expect(wwwHttps.includes("http://www.sitecrawl.dev/index.php")).toBe(true);

    const wwwHttp = generateURLPermutations("http://www.sitecrawl.dev").map(
      x => x.href,
    );
    expect(wwwHttp.length).toBe(16);
    expect(wwwHttp.includes("https://sitecrawl.dev/")).toBe(true);
    expect(wwwHttp.includes("https://sitecrawl.dev/index.html")).toBe(true);
    expect(wwwHttp.includes("https://sitecrawl.dev/index.php")).toBe(true);
    expect(wwwHttp.includes("https://www.sitecrawl.dev/")).toBe(true);
    expect(wwwHttp.includes("https://www.sitecrawl.dev/index.html")).toBe(true);
    expect(wwwHttp.includes("https://www.sitecrawl.dev/index.php")).toBe(true);
    expect(wwwHttp.includes("http://sitecrawl.dev/")).toBe(true);
    expect(wwwHttp.includes("http://sitecrawl.dev/index.html")).toBe(true);
    expect(wwwHttp.includes("http://sitecrawl.dev/index.php")).toBe(true);
    expect(wwwHttp.includes("http://www.sitecrawl.dev/")).toBe(true);
    expect(wwwHttp.includes("http://www.sitecrawl.dev/index.html")).toBe(true);
    expect(wwwHttp.includes("http://www.sitecrawl.dev/index.php")).toBe(true);
  });
});
