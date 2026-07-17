/**
 * Sitecrawl Java SDK — a type-safe client for the Sitecrawl v2 web scraping API.
 *
 * <p>Quick start:
 * <pre>{@code
 * import com.sitecrawl.client.SitecrawlClient;
 * import com.sitecrawl.models.*;
 *
 * SitecrawlClient client = SitecrawlClient.builder()
 *     .apiKey("fc-your-api-key")
 *     .build();
 *
 * Document doc = client.scrape("https://example.com",
 *     ScrapeOptions.builder()
 *         .formats(List.of("markdown"))
 *         .build());
 *
 * System.out.println(doc.getMarkdown());
 * }</pre>
 *
 * @see com.sitecrawl.client.SitecrawlClient
 */
package com.sitecrawl;
