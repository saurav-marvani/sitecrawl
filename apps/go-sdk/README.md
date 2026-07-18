# Sitecrawl Go SDK

Go SDK for the [Sitecrawl](https://sitecrawl.dev) v2 web scraping API.

## Requirements

- **Go:** 1.23 or later

## Installation

```bash
go get github.com/sitecrawl/sitecrawl/apps/go-sdk
```

## API Key Setup

Get your API key from the [Sitecrawl Dashboard](https://sitecrawl.dev) and set it as an environment variable:

```bash
export SITECRAWL_API_KEY="fc-your-api-key-here"
```

## Quick Start

```go
package main

import (
	"context"
	"fmt"
	"log"

	sitecrawl "github.com/sitecrawl/sitecrawl/apps/go-sdk"
	"github.com/sitecrawl/sitecrawl/apps/go-sdk/option"
)

func main() {
	// Create a client (reads SITECRAWL_API_KEY from environment)
	client, err := sitecrawl.NewClient()
	if err != nil {
		log.Fatal(err)
	}

	// Or provide the API key directly
	client, err = sitecrawl.NewClient(
		option.WithAPIKey("fc-your-api-key"),
	)
	if err != nil {
		log.Fatal(err)
	}

	ctx := context.Background()

	// Scrape a single page
	doc, err := client.Scrape(ctx, "https://example.com", &sitecrawl.ScrapeOptions{
		Formats: []string{"markdown"},
	})
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(doc.Markdown)
}
```

## Configuration

```go
client, err := sitecrawl.NewClient(
	option.WithAPIKey("fc-your-api-key"),          // API key (or set SITECRAWL_API_KEY env var)
	option.WithAPIURL("https://api.sitecrawl.dev"), // Custom API URL
	option.WithMaxRetries(3),                        // Max retry attempts (default: 3)
	option.WithBackoffFactor(0.5),                   // Backoff factor in seconds (default: 0.5)
	option.WithTimeout(5 * time.Minute),             // HTTP timeout (default: 5 minutes)
	option.WithHTTPClient(customHTTPClient),          // Custom *http.Client
)
```

## API Reference

### Scrape

Scrape a single URL and get its content.

```go
// Basic scrape
doc, err := client.Scrape(ctx, "https://example.com", nil)

// With options
doc, err := client.Scrape(ctx, "https://example.com", &sitecrawl.ScrapeOptions{
	Formats:         []string{"markdown", "html"},
	OnlyMainContent: sitecrawl.Bool(true),
	WaitFor:         sitecrawl.Int(5000),
	Location:        &sitecrawl.LocationConfig{Country: "US"},
})
```

### Video Extraction

Use the `video` format on supported video URLs, including YouTube and TikTok. The returned `Video` field is a signed URL to the extracted video file.

```go
doc, err := client.Scrape(ctx, "https://www.youtube.com/watch?v=dQw4w9WgXcQ", &sitecrawl.ScrapeOptions{
	Formats: []string{"video"},
})
if err != nil {
	return err
}
fmt.Println(doc.Video)
```

### Product Extraction

Use the `product` format on product pages for structured product extraction
(title, price, availability, variants). The result is returned on the document's
`Product` field. This is the deterministic counterpart to the LLM-based `json` format.

```go
doc, err := client.Scrape(ctx, "https://example.com/products/widget", &sitecrawl.ScrapeOptions{
	Formats: []string{"product"},
})
if err != nil {
	return err
}
fmt.Println(doc.Product)
```

### Menu Extraction

Use the `menu` format on menu pages for structured menu extraction
(merchant, sections, items, prices, availability). The result is returned on the
document's `Menu` field. This is the deterministic counterpart to the LLM-based `json` format.

```go
doc, err := client.Scrape(ctx, "https://example.com/menu", &sitecrawl.ScrapeOptions{
	Formats: []string{"menu"},
})
if err != nil {
	return err
}
fmt.Println(doc.Menu)
```

#### Interactive Browser

Execute code in a scrape-bound browser session:

```go
resp, err := client.Interact(ctx, scrapeJobID, "document.title", &sitecrawl.InteractParams{
	Language: "node",
	Timeout:  sitecrawl.Int(30),
})

// Stop the browser session
deleteResp, err := client.StopInteractiveBrowser(ctx, scrapeJobID)
```

### Parse

Upload a local file (`html`, `pdf`, `docx`, etc.) via multipart form data and
parse it synchronously. Parse options intentionally exclude browser-only
features such as change tracking, screenshot, branding, product, menu, audio, video, actions,
waitFor, location, and mobile. The `Proxy` option only accepts `"auto"` or `"basic"`.

```go
// From disk
file, err := sitecrawl.NewParseFileFromPath("./document.pdf")

// Or from memory
file := sitecrawl.NewParseFileFromBytes("upload.html", []byte("<html>hi</html>"))
file.ContentType = "text/html"

doc, err := client.Parse(ctx, file, &sitecrawl.ParseOptions{
	Formats: []string{"markdown"},
})
fmt.Println(doc.Markdown)
```

### Crawl

Crawl a website and get content from multiple pages.

```go
// Auto-polling: starts the crawl and waits for completion
job, err := client.Crawl(ctx, "https://example.com", &sitecrawl.CrawlOptions{
	Limit:             sitecrawl.Int(50),
	MaxDiscoveryDepth: sitecrawl.Int(3),
	ScrapeOptions:     &sitecrawl.ScrapeOptions{
		Formats: []string{"markdown"},
	},
})

// Or manage polling manually
resp, err := client.StartCrawl(ctx, "https://example.com", &sitecrawl.CrawlOptions{
	Limit: sitecrawl.Int(50),
})

// Check status
status, err := client.GetCrawlStatus(ctx, resp.ID)

// Cancel
_, err = client.CancelCrawl(ctx, resp.ID)

// Get errors
errors, err := client.GetCrawlErrors(ctx, resp.ID)
```

### Batch Scrape

Scrape multiple URLs in a single batch job.

```go
urls := []string{
	"https://example.com/page1",
	"https://example.com/page2",
	"https://example.com/page3",
}

// Auto-polling
job, err := client.BatchScrape(ctx, urls, &sitecrawl.BatchScrapeOptions{
	ScrapeOptions: &sitecrawl.ScrapeOptions{
		Formats: []string{"markdown"},
	},
})

// Or manage manually
resp, err := client.StartBatchScrape(ctx, urls, nil)
status, err := client.GetBatchScrapeStatus(ctx, resp.ID)
_, err = client.CancelBatchScrape(ctx, resp.ID)
```

### Map

Discover URLs on a website.

```go
mapData, err := client.Map(ctx, "https://example.com", &sitecrawl.MapOptions{
	Search:            sitecrawl.String("pricing"),
	IncludeSubdomains: sitecrawl.Bool(true),
	Limit:             sitecrawl.Int(100),
})
```

### Search

Search the web and get scraped results.

```go
results, err := client.Search(ctx, "sitecrawl web scraping", &sitecrawl.SearchOptions{
	Limit: sitecrawl.Int(5),
	ScrapeOptions: &sitecrawl.ScrapeOptions{
		Formats: []string{"markdown"},
	},
})
```

### Agent

Run an AI-powered agent to extract structured data.

```go
// Auto-polling
status, err := client.Agent(ctx, &sitecrawl.AgentOptions{
	Prompt: "Find all pricing plans and their features",
	URLs:   []string{"https://example.com/pricing"},
	Schema: map[string]interface{}{
		"type": "object",
		"properties": map[string]interface{}{
			"plans": map[string]interface{}{
				"type": "array",
				"items": map[string]interface{}{
					"type": "object",
					"properties": map[string]interface{}{
						"name":  map[string]interface{}{"type": "string"},
						"price": map[string]interface{}{"type": "string"},
					},
				},
			},
		},
	},
})

// Or manage manually
resp, err := client.StartAgent(ctx, &sitecrawl.AgentOptions{
	Prompt: "Extract product information",
})
status, err := client.GetAgentStatus(ctx, resp.ID)
_, err = client.CancelAgent(ctx, resp.ID)
```

### Browser

Create and manage standalone browser sessions.

```go
// Create a browser session
session, err := client.Browser(ctx, &sitecrawl.BrowserOptions{
	TTL:           sitecrawl.Int(300),
	StreamWebView: sitecrawl.Bool(true),
})

// Execute code
result, err := client.BrowserExecute(ctx, session.ID, "echo 'hello'", &sitecrawl.BrowserExecuteParams{
	Language: "bash",
	Timeout:  sitecrawl.Int(30),
})

// List sessions
list, err := client.ListBrowsers(ctx, "active")

// Delete session
_, err = client.DeleteBrowser(ctx, session.ID)
```

### Usage & Metrics

```go
// Check concurrency
concurrency, err := client.GetConcurrency(ctx)
fmt.Printf("Using %d of %d\n", concurrency.Concurrency, concurrency.MaxConcurrency)

// Check credit usage
credits, err := client.GetCreditUsage(ctx)
fmt.Printf("Remaining: %d of %d\n", credits.RemainingCredits, credits.PlanCredits)
```

## Error Handling

The SDK uses typed errors for different failure scenarios:

```go
doc, err := client.Scrape(ctx, "https://example.com", nil)
if err != nil {
	var authErr *sitecrawl.AuthenticationError
	var rateErr *sitecrawl.RateLimitError
	var timeoutErr *sitecrawl.JobTimeoutError
	var fcErr *sitecrawl.SitecrawlError

	switch {
	case errors.As(err, &authErr):
		fmt.Println("Invalid API key:", authErr.Message)
	case errors.As(err, &rateErr):
		fmt.Println("Rate limited:", rateErr.Message)
	case errors.As(err, &timeoutErr):
		fmt.Printf("Job %s timed out after %ds\n", timeoutErr.JobID, timeoutErr.TimeoutSeconds)
	case errors.As(err, &fcErr):
		fmt.Printf("API error (HTTP %d): %s\n", fcErr.StatusCode, fcErr.Message)
	default:
		fmt.Println("Unexpected error:", err)
	}
}
```

### Retry Logic

The SDK automatically retries transient failures:
- **Retried:** 408, 409, 5xx errors, and connection failures
- **Not retried:** 401, 429, and other 4xx errors
- **Backoff:** Exponential backoff with configurable factor

## Context Support

All methods accept a `context.Context` for cancellation and deadline control:

```go
ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
defer cancel()

doc, err := client.Scrape(ctx, "https://example.com", nil)
```

## Pointer Helpers

The SDK provides convenience functions for optional fields:

```go
sitecrawl.Bool(true)     // *bool
sitecrawl.Int(50)        // *int
sitecrawl.Int64(1000)    // *int64
sitecrawl.String("test") // *string
sitecrawl.Float64(0.5)   // *float64
```

## Releases

The Go SDK lives in a monorepo subdirectory, so releases follow Go's
[nested module tagging](https://go.dev/ref/mod#vcs-version) convention. Tags
**must** be prefixed with the module subdirectory path:

```
apps/go-sdk/v1.3.0
```

A bare `v1.3.0` tag will not be resolvable by the Go module proxy.

### Release workflow

The SDK version is the single source of truth in
[`version.go`](./version.go):

```go
const Version = "1.3.0"
```

To cut a release:

1. Bump the `Version` constant in `apps/go-sdk/version.go`
2. Merge to `main`
3. The [`publish-go-sdk`](../../.github/workflows/publish-go-sdk.yml) workflow
   will automatically:
   - create the `apps/go-sdk/v{Version}` tag on the merge commit,
   - push it to the repository,
   - warm `proxy.golang.org` to trigger indexing on
     [pkg.go.dev](https://pkg.go.dev/github.com/sitecrawl/sitecrawl/apps/go-sdk).

The workflow is idempotent: if the tag already exists, it is a no-op.

### Consuming a specific version

```bash
go get github.com/sitecrawl/sitecrawl/apps/go-sdk@v1.3.0
```

Users pin via the semantic version suffix; they never reference the
`apps/go-sdk/` tag prefix directly — Go's toolchain handles the translation.

## License

MIT
