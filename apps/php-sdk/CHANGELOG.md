# Changelog

All notable changes to the Sitecrawl PHP SDK will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.9.0] - 2026-07-10

### Added
- Laravel AI SDK integration: native tool classes `SitecrawlScrape`, `SitecrawlSearch`,
  `SitecrawlMap`, and `SitecrawlCrawl` in `Sitecrawl\Laravel\Tools`, plus a
  `SitecrawlTools::all()` helper. Drop them into any `laravel/ai` agent's `tools()`
  array; API key and config are reused from the existing Laravel integration.
  Requires `laravel/ai ^0.9` (PHP 8.3+, Laravel 12+) in the consuming app.
- `CrawlOptions::with(idempotencyKey:)`: `startCrawl()` now sends the
  `x-idempotency-key` header, matching the existing batch scrape support.
- `startCrawl()` and `getCrawlStatus()` accept an optional per-request
  timeout in seconds.

### Fixed
- `scrape()`, `search()`, and `map()` now throw `SitecrawlException` when the API
  returns an HTTP 200 response with `success: false` (for example DNS resolution
  failures), instead of silently hydrating an empty result.

## [1.3.0] - 2026-05-12

### Added
- Added `video` scrape format support and `Document::getVideo()` for video extraction results.

## [1.1.0] - 2026-04-21

### Added
- Parse: `parse()` with `ParseFile` and `ParseOptions` models for uploading
  local files (`html`, `pdf`, `docx`, etc.) to the `/v2/parse` endpoint via
  multipart form data.

## [1.0.0] - 2026-04-13

### Added
- Initial release with Sitecrawl v2 API support
- Scrape: `scrape()`, `interact()`, `stopInteractiveBrowser()`
- Crawl: `crawl()`, `startCrawl()`, `getCrawlStatus()`, `cancelCrawl()`, `getCrawlErrors()`
- Batch Scrape: `batchScrape()`, `startBatchScrape()`, `getBatchScrapeStatus()`, `cancelBatchScrape()`
- Map: `map()`
- Search: `search()`
- Agent: `agent()`, `startAgent()`, `getAgentStatus()`, `cancelAgent()`
- Browser: `browser()`, `browserExecute()`, `deleteBrowser()`, `listBrowsers()`
- Usage: `getConcurrency()`, `getCreditUsage()`
- Automatic polling with pagination for async jobs (crawl, batch scrape, agent)
- Retry with exponential backoff for transient failures (408, 409, 502, 5xx)
- Typed exception hierarchy: `SitecrawlException`, `AuthenticationException`, `RateLimitException`, `JobTimeoutException`
- Laravel integration: auto-discovered service provider, publishable config, `Sitecrawl` facade
- PHP 8.1+ support with named parameters and readonly properties
