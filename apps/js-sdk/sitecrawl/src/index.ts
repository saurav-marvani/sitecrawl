/**
 * Sitecrawl JS/TS SDK — unified entrypoint.
 * - v2 by default on the top‑level client
 * - v1 available under `.v1` (feature‑frozen)
 * - Exports: `Sitecrawl` (default), `SitecrawlClient` (v2), `SitecrawlAppV1` (v1), and v2 types
 */

/** Direct v2 client. */
export { SitecrawlClient } from "./v2/client";
/** Public v2 request/response types. */
export * from "./v2/types";
/** Watcher class and options for crawl/batch job monitoring. */
export { Watcher, type WatcherOptions } from "./v2/watcher";
/** Research sub-client (accessed via `sitecrawl.research`). */
export { ResearchClient } from "./v2/methods/research";
/** Legacy v1 client (feature‑frozen). */
export { default as SitecrawlAppV1 } from "./v1";

import V1 from "./v1";
import { SitecrawlClient as V2, type SitecrawlClientOptions, type SitecrawlClientInput } from "./v2/client";
import type { SitecrawlAppConfig } from "./v1";

// Re-export v2 client options for convenience
export type { SitecrawlClientOptions, SitecrawlClientInput } from "./v2/client";

/** Unified client: extends v2 and adds `.v1` for backward compatibility. */
export class Sitecrawl extends V2 {
  /** Feature‑frozen v1 client (lazy). */
  private _v1?: V1;
  private _v1Opts: SitecrawlAppConfig;

  /** @param opts API key string or credentials object. */
  constructor(opts: SitecrawlClientInput = {}) {
    const resolved: SitecrawlClientOptions =
      typeof opts === "string" ? { apiKey: opts } : opts;
    super(resolved);
    this._v1Opts = {
      apiKey: resolved.apiKey,
      apiUrl: resolved.apiUrl,
    };
  }

  /** Access the legacy v1 client (instantiated on first access). */
  get v1(): V1 {
    if (!this._v1) this._v1 = new V1(this._v1Opts);
    return this._v1;
  }
}

// Copy V2 method descriptors onto Sitecrawl.prototype so that
// Object.getOwnPropertyNames(Object.getPrototypeOf(app)) includes them.
(function exposeV2MethodsOnTopLevel() {
  for (const name of Object.getOwnPropertyNames(V2.prototype)) {
    if (name === "constructor") continue;
    if (Object.prototype.hasOwnProperty.call(Sitecrawl.prototype, name)) continue;
    const desc = Object.getOwnPropertyDescriptor(V2.prototype, name);
    if (desc) Object.defineProperty(Sitecrawl.prototype, name, desc);
  }
})();

export default Sitecrawl;

