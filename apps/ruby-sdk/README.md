# Sitecrawl Ruby SDK

Ruby SDK for the [Sitecrawl](https://sitecrawl.dev) v2 web scraping API.

## Prerequisites

- Ruby >= 3.0

## Installation

Add to your `Gemfile`:

```ruby
gem "sitecrawl-sdk", "~> 1.5"
```

Or install directly:

```bash
gem install sitecrawl-sdk
```

## Quick Start

```ruby
require "sitecrawl"

# Create a client
client = Sitecrawl::Client.new(api_key: "fc-your-api-key")

# Or load from SITECRAWL_API_KEY environment variable
client = Sitecrawl::Client.from_env

# Scrape a single page
doc = client.scrape("https://example.com")
puts doc.markdown
```

## Environment Setup

```bash
export SITECRAWL_API_KEY="fc-your-api-key"
# Optional: custom API URL
export SITECRAWL_API_URL="http://localhost:3002"
```

## API Reference

### Scrape

```ruby
# Basic scrape
doc = client.scrape("https://example.com")
puts doc.markdown

# Scrape with options
doc = client.scrape("https://example.com",
  Sitecrawl::Models::ScrapeOptions.new(
    formats: ["markdown", "html"],
    only_main_content: true,
    wait_for: 1000
  ))
puts doc.html
```

### Video Extraction

Use the `video` format on supported video URLs, including YouTube and TikTok. The returned `video` field is a signed URL to the extracted video file.

```ruby
doc = client.scrape("https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  Sitecrawl::Models::ScrapeOptions.new(formats: ["video"]))

puts doc.video
```

### Product Extraction

Use the `product` format on product pages to get structured product data
(title, brand, category, and per-variant price, availability, and images).
It is the deterministic counterpart to the LLM-based `json` format. The
returned `product` field contains the extracted fields.

```ruby
doc = client.scrape("https://example.com/products/widget",
  Sitecrawl::Models::ScrapeOptions.new(formats: ["product"]))

puts doc.product
```

### Menu Extraction

Use the `menu` format on restaurant/merchant menu pages to get structured
menu data (merchant profile plus ordered sections, each holding items with
per-item price, availability, images, and dietary information). It is the
deterministic counterpart to the LLM-based `json` format. The returned `menu`
field contains the extracted fields.

```ruby
doc = client.scrape("https://example.com/menu",
  Sitecrawl::Models::ScrapeOptions.new(formats: ["menu"]))

puts doc.menu
```

### Parse

Upload a local file (`html`, `pdf`, `docx`, etc.) via multipart form data and
parse it synchronously. Parse options intentionally exclude browser-only
features such as change tracking, screenshot, branding, audio, video, product, actions,
wait_for, location, and mobile. The `proxy` option only accepts `"auto"` or `"basic"`.

```ruby
# From disk
file = Sitecrawl::Models::ParseFile.from_path("./document.pdf")

# Or from memory
file = Sitecrawl::Models::ParseFile.new(
  filename: "upload.html",
  content: "<html>hi</html>",
  content_type: "text/html"
)

doc = client.parse(file,
  Sitecrawl::Models::ParseOptions.new(formats: ["markdown"]))
puts doc.markdown
```

### Crawl

```ruby
# Crawl with auto-polling (blocks until complete)
job = client.crawl("https://example.com",
  Sitecrawl::Models::CrawlOptions.new(limit: 50))
job.data.each { |doc| puts doc.markdown }

# Async crawl
response = client.start_crawl("https://example.com",
  Sitecrawl::Models::CrawlOptions.new(limit: 10))
puts response.id

# Check status
status = client.get_crawl_status(response.id)
puts status.status

# Cancel
client.cancel_crawl(response.id)
```

### Batch Scrape

```ruby
urls = ["https://example.com/page1", "https://example.com/page2"]

# Batch scrape with auto-polling
job = client.batch_scrape(urls,
  Sitecrawl::Models::BatchScrapeOptions.new(
    options: Sitecrawl::Models::ScrapeOptions.new(formats: ["markdown"])
  ))
job.data.each { |doc| puts doc.markdown }
```

### Map

```ruby
# Discover URLs on a website
result = client.map("https://example.com")
result.links.each { |link| puts link["url"] }

# With options
result = client.map("https://example.com",
  Sitecrawl::Models::MapOptions.new(limit: 100, search: "blog"))
```

### Search

```ruby
# Web search
results = client.search("sitecrawl web scraping")
results.web&.each { |r| puts r["url"] }

# With options
results = client.search("latest news",
  Sitecrawl::Models::SearchOptions.new(limit: 5, location: "US"))
```

### Agent

```ruby
# Run an AI agent task (blocks until complete)
status = client.agent(
  Sitecrawl::Models::AgentOptions.new(
    prompt: "Find the pricing information",
    urls: ["https://example.com"]
  ))
puts status.data
```

### Usage & Metrics

```ruby
# Check concurrency
concurrency = client.get_concurrency
puts concurrency.concurrency

# Check credit usage
usage = client.get_credit_usage
puts usage.remaining_credits
```

## Configuration

```ruby
client = Sitecrawl::Client.new(
  api_key: "fc-your-api-key",
  api_url: "https://api.sitecrawl.dev",  # custom API URL
  timeout: 300,                           # HTTP timeout in seconds
  max_retries: 3,                         # automatic retries
  backoff_factor: 0.5                     # exponential backoff factor
)
```

## Error Handling

```ruby
begin
  doc = client.scrape("https://example.com")
rescue Sitecrawl::AuthenticationError => e
  puts "Invalid API key: #{e.message}"
rescue Sitecrawl::RateLimitError => e
  puts "Rate limited: #{e.message}"
rescue Sitecrawl::JobTimeoutError => e
  puts "Job #{e.job_id} timed out after #{e.timeout_seconds}s"
rescue Sitecrawl::SitecrawlError => e
  puts "Error (#{e.status_code}): #{e.message}"
end
```

## Development

### Building from Source

```bash
cd apps/ruby-sdk
bundle install
```

### Running Tests

```bash
# Unit tests
bundle exec rake test

# With API key for E2E tests
SITECRAWL_API_KEY=fc-your-key bundle exec rake test
```

## License

MIT License - see [LICENSE](LICENSE).
