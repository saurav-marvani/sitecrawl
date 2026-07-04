import http from "http";
import {
  describeIf,
  idmux,
  Identity,
  TEST_PRODUCTION,
  TEST_SUITE_WEBSITE,
  scrapeTimeout,
} from "../lib";
import {
  batchScrape,
  crawl,
  creditUsage,
  scrape,
  scrapeRaw,
  searchRaw,
} from "./lib";

// =========================================
// Threat protection billing (ENG-4985)
//
// Billing rules under test:
//   - +2 credits per domain scanned in "normal" mode (Google Web Risk)
//   - +3 credits per domain scanned in "enhanced" mode (alphaMountain)
//   - a "scan" = a ThreatDecision with providerConsulted (fresh AND cached
//     provider verdicts both bill — cache hits bill)
//   - blocked requests still bill the scan fee (no base scrape cost, matching
//     how other failed scrapes bill)
//   - local-only decisions (whitelist/blacklist/blocked-tld) never bill
//
// These tests need the mock providers below. Start the harness with the
// base-URL overrides pointing at them, e.g.:
//
//   GOOGLE_WEB_RISK_API_KEY=test \
//   GOOGLE_WEB_RISK_API_URL=http://localhost:4519 \
//   ALPHAMOUNTAIN_API_KEY=test \
//   ALPHAMOUNTAIN_API_URL=http://localhost:4520 \
//   pnpm harness pnpm exec vitest run src/__tests__/snips/v2/threat-protection-billing.test.ts
//
// Tests that need a provider self-skip when the corresponding override is not
// set to a local address. NOTE: this file binds the mock ports itself — do not
// run it in the same pass as another file using the same ports (e.g.
// threat-protection-enforcement.test.ts if given the same Web Risk port).
// =========================================

// Fixture domains. *.example.com is reserved (RFC 2606) — these domains are
// never actually fetched: blocked scrapes fail before any outbound request.
const BLACKLISTED_DOMAIN = "threat-billing-blacklisted.example.com";
const RISKY_DOMAIN = "threat-billing-risky.example.com";

const CLEAN_URL = TEST_SUITE_WEBSITE;

// A stable cross-hostname redirect: google.com 301s to www.google.com. The
// mock flags only the redirect target, so the scrape consults the provider
// twice (initial domain + redirect re-check) before being blocked.
const REDIRECT_SOURCE_URL = "https://google.com/";
const REDIRECT_TARGET_DOMAIN = "www.google.com";

const MOCK_RISKY_DOMAINS = new Set([RISKY_DOMAIN, REDIRECT_TARGET_DOMAIN]);

const isLocalMock = (url: string) =>
  /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(url);

const webRiskMockUrl = process.env.GOOGLE_WEB_RISK_API_URL ?? "";
const HAS_WEB_RISK_MOCK =
  isLocalMock(webRiskMockUrl) && !!process.env.GOOGLE_WEB_RISK_API_KEY;

const alphaMountainMockUrl = process.env.ALPHAMOUNTAIN_API_URL ?? "";
const HAS_ALPHAMOUNTAIN_MOCK =
  isLocalMock(alphaMountainMockUrl) && !!process.env.ALPHAMOUNTAIN_API_KEY;

const sleep = (ms: number) => new Promise(x => setTimeout(() => x(true), ms));
// Credit deductions land through the batched billing queue; see billing.test.ts.
const sleepForBatchBilling = () => sleep(40000);

let webRiskServer: http.Server | null = null;
const webRiskHits = new Map<string, number>();

function startWebRiskMock(): Promise<void> {
  const port = Number(new URL(webRiskMockUrl).port);
  webRiskServer = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", webRiskMockUrl);
    if (url.pathname === "/v1/uris:search") {
      const uri = url.searchParams.get("uri") ?? "";
      let domain = "";
      try {
        domain = new URL(uri).hostname;
      } catch (_) {}
      webRiskHits.set(domain, (webRiskHits.get(domain) ?? 0) + 1);
      res.setHeader("Content-Type", "application/json");
      if (MOCK_RISKY_DOMAINS.has(domain)) {
        res.end(
          JSON.stringify({
            threat: {
              threatTypes: ["MALWARE"],
              expireTime: new Date(Date.now() + 3600_000).toISOString(),
            },
          }),
        );
      } else {
        res.end(JSON.stringify({}));
      }
    } else {
      res.statusCode = 404;
      res.end("{}");
    }
  });
  return new Promise((resolve, reject) => {
    webRiskServer!.once("error", reject);
    webRiskServer!.listen(port, () => resolve());
  });
}

let alphaMountainServer: http.Server | null = null;

// Minimal alphaMountain mock: /threat/uri and /category/uri are required by
// the provider (it throws if either fails); /intelligence/hostname is
// best-effort. All domains score 1.0/10 (=10/100, well below the default
// 75 threshold) so enhanced-mode scrapes stay clean.
function startAlphaMountainMock(): Promise<void> {
  const port = Number(new URL(alphaMountainMockUrl).port);
  alphaMountainServer = http.createServer((req, res) => {
    let body = "";
    req.on("data", chunk => (body += chunk));
    req.on("end", () => {
      res.setHeader("Content-Type", "application/json");
      if (req.url === "/threat/uri") {
        res.end(
          JSON.stringify({
            version: 1,
            status: { threat: "OK" },
            threat: { score: 1.0, scope: "domain", source: "mock" },
            ttl: 3600,
          }),
        );
      } else if (req.url === "/category/uri") {
        res.end(
          JSON.stringify({
            version: 1,
            status: { category: "OK" },
            category: { categories: [], scope: "domain", confidence: 1 },
            ttl: 3600,
          }),
        );
      } else if (req.url === "/intelligence/hostname") {
        res.end(JSON.stringify({ version: 1, status: {}, sections: {} }));
      } else {
        res.statusCode = 404;
        res.end("{}");
      }
    });
  });
  return new Promise((resolve, reject) => {
    alphaMountainServer!.once("error", reject);
    alphaMountainServer!.listen(port, () => resolve());
  });
}

describeIf(TEST_PRODUCTION)("Threat protection billing", () => {
  beforeAll(async () => {
    if (HAS_WEB_RISK_MOCK) {
      await startWebRiskMock();
    }
    if (HAS_ALPHAMOUNTAIN_MOCK) {
      await startAlphaMountainMock();
    }
  });

  afterAll(async () => {
    if (webRiskServer) {
      await new Promise(resolve => webRiskServer!.close(resolve));
      webRiskServer = null;
    }
    if (alphaMountainServer) {
      await new Promise(resolve => alphaMountainServer!.close(resolve));
      alphaMountainServer = null;
    }
  });

  describe("scrape", () => {
    let identity: Identity;

    beforeAll(async () => {
      identity = await idmux({
        name: "threat-protection-billing/scrape",
        flags: { threatProtection: "allowed" },
        credits: 1_000_000,
      });
    });

    (HAS_WEB_RISK_MOCK ? it : it.skip)(
      "normal-mode clean scrape bills base + 2",
      async () => {
        const doc = await scrape(
          {
            url: CLEAN_URL,
            threatProtection: { mode: "normal", failurePolicy: "open" },
          } as any,
          identity,
        );
        expect(doc.metadata.creditsUsed).toBe(3);
      },
      scrapeTimeout,
    );

    (HAS_ALPHAMOUNTAIN_MOCK ? it : it.skip)(
      "enhanced-mode clean scrape bills base + 3",
      async () => {
        const doc = await scrape(
          {
            url: CLEAN_URL,
            threatProtection: { mode: "enhanced", failurePolicy: "open" },
          } as any,
          identity,
        );
        expect(doc.metadata.creditsUsed).toBe(4);
      },
      scrapeTimeout,
    );

    (HAS_WEB_RISK_MOCK ? it : it.skip)(
      "second scrape of the same domain within the cache TTL still bills + 2",
      async () => {
        const cleanDomain = new URL(CLEAN_URL).hostname;

        const first = await scrape(
          {
            url: CLEAN_URL,
            threatProtection: { mode: "normal", failurePolicy: "open" },
          } as any,
          identity,
        );
        expect(first.metadata.creditsUsed).toBe(3);

        const hitsAfterFirst = webRiskHits.get(cleanDomain) ?? 0;

        const second = await scrape(
          {
            url: CLEAN_URL,
            threatProtection: { mode: "normal", failurePolicy: "open" },
          } as any,
          identity,
        );
        // The verdict is now Redis-cached, so no new provider hit — but the
        // cached scan still bills.
        expect(webRiskHits.get(cleanDomain) ?? 0).toBe(hitsAfterFirst);
        expect(second.metadata.creditsUsed).toBe(3);
      },
      scrapeTimeout * 2,
    );

    it(
      "scan costs are visible in the document's creditsUsed metadata",
      async () => {
        // Local-only allow (whitelist): no provider consulted, so a plain
        // 1-credit scrape — proves the fee only appears when a scan happened.
        const cleanDomain = new URL(CLEAN_URL).hostname;
        const doc = await scrape(
          {
            url: CLEAN_URL,
            threatProtection: {
              mode: "normal",
              whitelist: [cleanDomain],
              failurePolicy: "closed",
            },
          } as any,
          identity,
        );
        expect(doc.metadata.creditsUsed).toBe(1);
      },
      scrapeTimeout,
    );
  });

  describe("blocked scrapes (end-to-end credit deduction)", () => {
    (HAS_WEB_RISK_MOCK ? it : it.skip)(
      "bills scan fees for blocked scrapes, nothing for local-only blocks",
      async () => {
        // Dedicated team so the credit delta is exactly attributable.
        const identity = await idmux({
          name: "threat-protection-billing/blocked",
          flags: { threatProtection: "allowed" },
          credits: 1_000_000,
        });

        // A fresh team's credit grant can land a moment after idmux returns;
        // poll until the baseline read reflects it so the delta is exact.
        let before = 0;
        for (let i = 0; i < 30 && before <= 0; i++) {
          before = (await creditUsage(identity)).remainingCredits;
          if (before <= 0) await sleep(1000);
        }
        expect(before).toBeGreaterThan(0);

        // 1. Blocked by provider verdict: 0 base + 2 scan.
        const blocked = await scrapeRaw(
          {
            url: `https://${RISKY_DOMAIN}/`,
            threatProtection: { mode: "normal", failurePolicy: "open" },
          } as any,
          identity,
        );
        expect(blocked.statusCode).toBe(403);
        expect(blocked.body.code).toBe("unsafe_domain_blocked");

        // 2. Blocked by blacklist (local-only): no scan fee, no base cost.
        const blacklisted = await scrapeRaw(
          {
            url: `https://${BLACKLISTED_DOMAIN}/page`,
            threatProtection: {
              mode: "normal",
              blacklist: [BLACKLISTED_DOMAIN],
            },
          } as any,
          identity,
        );
        expect(blacklisted.statusCode).toBe(403);
        expect(blacklisted.body.code).toBe("unsafe_domain_blocked");

        // 3. Clean domain redirecting to a blocked domain: two consulted
        //    decisions (initial + redirect re-check) → two scan fees.
        const redirected = await scrapeRaw(
          {
            url: REDIRECT_SOURCE_URL,
            threatProtection: { mode: "normal", failurePolicy: "open" },
          } as any,
          identity,
        );
        expect(redirected.statusCode).toBe(403);
        expect(redirected.body.code).toBe("unsafe_domain_blocked");
        expect(redirected.body.error).toContain(REDIRECT_TARGET_DOMAIN);

        await sleepForBatchBilling();

        const after = (await creditUsage(identity)).remainingCredits;
        // 2 (blocked scan) + 0 (blacklist) + 4 (redirect: 2 scans) = 6
        expect(before - after).toBe(6);
      },
      scrapeTimeout * 3 + 60000,
    );
  });

  describe("crawl and batch scrape (per-document scan fees)", () => {
    let identity: Identity;

    beforeAll(async () => {
      identity = await idmux({
        name: "threat-protection-billing/crawl-batch",
        flags: { threatProtection: "allowed" },
        credits: 1_000_000,
      });
    });

    (HAS_WEB_RISK_MOCK ? it : it.skip)(
      "batch scrape bills base + 2 per document (cache hits bill)",
      async () => {
        const res = await batchScrape(
          {
            urls: [CLEAN_URL, `${CLEAN_URL}/blog`],
            threatProtection: { mode: "normal", failurePolicy: "open" },
          } as any,
          identity,
        );
        expect(res.data.length).toBe(2);
        for (const doc of res.data) {
          expect(doc.metadata.creditsUsed).toBe(3);
        }
      },
      scrapeTimeout * 2,
    );

    (HAS_WEB_RISK_MOCK ? it : it.skip)(
      "crawl bills base + 2 per scraped document",
      async () => {
        const res = await crawl(
          {
            url: CLEAN_URL,
            limit: 2,
            scrapeOptions: {
              threatProtection: { mode: "normal", failurePolicy: "open" },
            },
          } as any,
          identity,
        );
        expect(res.status).toBe("completed");
        expect(res.data.length).toBeGreaterThan(0);
        for (const doc of res.data) {
          expect(doc.metadata.creditsUsed).toBe(3);
        }
      },
      scrapeTimeout * 5,
    );
  });

  describe("search", () => {
    let identity: Identity;

    beforeAll(async () => {
      identity = await idmux({
        name: "threat-protection-billing/search",
        flags: { threatProtection: "allowed" },
        credits: 1_000_000,
      });
    });

    (HAS_WEB_RISK_MOCK ? it : it.skip)(
      "bills a scan fee per result domain on top of normal search billing",
      async () => {
        const limit = 20;
        const res = await searchRaw(
          {
            query: "firecrawl",
            includeDomains: ["firecrawl.dev"],
            limit,
            timeout: 120000,
            threatProtection: { mode: "normal", failurePolicy: "open" },
          } as any,
          identity,
        );
        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);

        const web: { url: string }[] = res.body.data.web ?? [];
        expect(web.length).toBeGreaterThan(0);

        const uniqueDomains = new Set(
          web.map(x => new URL(x.url).hostname.toLowerCase()),
        );
        const searchCredits = Math.ceil(web.length / 10) * 2;

        if (web.length < limit) {
          // Nothing was sliced off, so the returned set IS the scanned set:
          // exactly one +2 scan fee per unique result domain.
          expect(res.body.creditsUsed).toBe(
            searchCredits + 2 * uniqueDomains.size,
          );
        } else {
          // The provider over-fetched (limit * 2 buffer) and results were
          // sliced; scanned domains ⊇ returned domains.
          expect(res.body.creditsUsed).toBeGreaterThanOrEqual(
            searchCredits + 2 * uniqueDomains.size,
          );
        }
      },
      scrapeTimeout * 2,
    );

    it(
      "search without provider scans bills plain search credits",
      async () => {
        // Local-only policy (everything blacklist-missed resolves via
        // failurePolicy "open" without a provider configured => no consulted
        // decisions => no scan fees). With the mock provider configured this
        // still holds a stronger property: whitelisted domains short-circuit.
        const res = await searchRaw(
          {
            query: "firecrawl",
            includeDomains: ["firecrawl.dev"],
            limit: 5,
            timeout: 120000,
          } as any,
          identity,
        );
        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        const web: { url: string }[] = res.body.data.web ?? [];
        expect(res.body.creditsUsed).toBe(Math.ceil(web.length / 10) * 2);
      },
      scrapeTimeout * 2,
    );
  });
});
