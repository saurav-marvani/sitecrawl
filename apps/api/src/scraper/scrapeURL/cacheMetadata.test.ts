import { afterEach, describe, expect, it } from "vitest";
import { buildCacheMetadata, buildScrapeCacheMetadata } from "./cacheMetadata";
import { config } from "../../config";

describe("buildCacheMetadata", () => {
  it("emits attested cache metadata and legacy hit fields for Firecrawl index hits", () => {
    expect(
      buildCacheMetadata({
        cacheInfo: { created_at: new Date("2026-07-14T12:00:00.000Z") },
        indexWasEligible: true,
      }),
    ).toEqual({
      cache: {
        source: "firecrawl-index",
        cachedAt: "2026-07-14T12:00:00.000Z",
      },
      cacheState: "hit",
      cachedAt: "2026-07-14T12:00:00.000Z",
    });
  });

  it("does not fabricate a miss when index was eligible but no cache hit was attested", () => {
    expect(
      buildCacheMetadata({
        indexWasEligible: true,
        legacyMissEnabled: false,
      }),
    ).toEqual({});
  });

  it("can temporarily emit the deprecated legacy miss behind the bridge flag", () => {
    expect(
      buildCacheMetadata({
        indexWasEligible: true,
        legacyMissEnabled: true,
      }),
    ).toEqual({ cacheState: "miss" });
  });

  it("does not emit miss when index was not eligible", () => {
    expect(
      buildCacheMetadata({
        indexWasEligible: false,
        legacyMissEnabled: true,
      }),
    ).toEqual({});
  });
});

describe("buildScrapeCacheMetadata", () => {
  const originalLegacyMissEnabled = config.LEGACY_CACHE_MISS_METADATA_ENABLED;

  afterEach(() => {
    config.LEGACY_CACHE_MISS_METADATA_ENABLED = originalLegacyMissEnabled;
  });

  it("threads the startup bridge flag into scrape metadata assembly", () => {
    config.LEGACY_CACHE_MISS_METADATA_ENABLED = true;

    expect(
      buildScrapeCacheMetadata({
        indexWasEligible: true,
      }),
    ).toEqual({ cacheState: "miss" });
  });

  it("keeps fabricated misses disabled at the scrape assembly boundary by default", () => {
    config.LEGACY_CACHE_MISS_METADATA_ENABLED = false;

    expect(
      buildScrapeCacheMetadata({
        indexWasEligible: true,
      }),
    ).toEqual({});
  });
});
