package com.sitecrawl;

import com.sitecrawl.client.SitecrawlClient;
import com.sitecrawl.models.Document;
import com.sitecrawl.models.ScrapeOptions;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Live Site Test - Sitecrawl.dev
 * 
 * Tests the Java SDK against the actual Sitecrawl production website.
 * This demonstrates real-world usage of the API against live content.
 * 
 * Run with: SITECRAWL_API_KEY=fc-xxx gradle test --tests "com.sitecrawl.SitecrawlLiveSiteTest"
 */
class SitecrawlLiveSiteTest {

    private static SitecrawlClient client;

    @BeforeAll
    static void setup() {
        String apiKey = System.getenv("SITECRAWL_API_KEY");
        if (apiKey != null && !apiKey.isBlank()) {
            client = SitecrawlClient.fromEnv();
        }
    }

    @Test
    @EnabledIfEnvironmentVariable(named = "SITECRAWL_API_KEY", matches = ".*\\S.*")
    void testScrapeSitecrawlHomepage() {
        System.out.println("\n=== Testing against LIVE Sitecrawl.dev website ===\n");
        System.out.println("Scraping: https://sitecrawl.dev");
        
        Document doc = client.scrape("https://sitecrawl.dev",
                ScrapeOptions.builder()
                        .formats(List.of("markdown", "html"))
                        .onlyMainContent(true)
                        .build());

        // Assertions
        assertNotNull(doc, "Document should not be null");
        assertNotNull(doc.getMarkdown(), "Markdown content should not be null");
        assertNotNull(doc.getHtml(), "HTML content should not be null");
        assertNotNull(doc.getMetadata(), "Metadata should not be null");
        
        // Verify it's actually the Sitecrawl site
        String markdown = doc.getMarkdown().toLowerCase();
        assertTrue(markdown.contains("sitecrawl") || markdown.contains("scrape") || markdown.contains("crawl"),
                "Content should mention Sitecrawl features");
        
        // Check metadata
        String sourceUrl = doc.getMetadata().get("sourceURL").toString();
        assertTrue(sourceUrl.contains("sitecrawl.dev"), "Source URL should be sitecrawl.dev");
        
        // Display results
        System.out.println("\n✓ Successfully scraped Sitecrawl.dev!");
        System.out.println("\nMetadata:");
        System.out.println("  Source URL: " + sourceUrl);
        if (doc.getMetadata().get("title") != null) {
            System.out.println("  Title: " + doc.getMetadata().get("title"));
        }
        System.out.println("  Status Code: " + doc.getMetadata().get("statusCode"));
        
        System.out.println("\nContent Stats:");
        System.out.println("  Markdown length: " + doc.getMarkdown().length() + " characters");
        System.out.println("  HTML length: " + doc.getHtml().length() + " characters");
        
        System.out.println("\nFirst 500 characters of markdown:");
        System.out.println("  " + doc.getMarkdown().substring(0, Math.min(500, doc.getMarkdown().length())).replace("\n", "\n  "));
        
        System.out.println("\n=== Live site test completed successfully! ===\n");
    }

    @Test
    @EnabledIfEnvironmentVariable(named = "SITECRAWL_API_KEY", matches = ".*\\S.*")
    void testScrapeSitecrawlPricing() {
        System.out.println("\n=== Testing Sitecrawl Pricing Page ===\n");
        System.out.println("Scraping: https://sitecrawl.dev/pricing");
        
        Document doc = client.scrape("https://sitecrawl.dev/pricing",
                ScrapeOptions.builder()
                        .formats(List.of("markdown"))
                        .build());

        // Assertions
        assertNotNull(doc, "Document should not be null");
        assertNotNull(doc.getMarkdown(), "Markdown content should not be null");
        
        String markdown = doc.getMarkdown().toLowerCase();
        assertTrue(markdown.contains("pricing") || markdown.contains("plan") || markdown.contains("price"),
                "Pricing page should contain pricing information");
        
        System.out.println("✓ Successfully scraped pricing page!");
        System.out.println("  Content length: " + doc.getMarkdown().length() + " characters");
        System.out.println("  Source: " + doc.getMetadata().get("sourceURL"));
    }

    @Test
    @EnabledIfEnvironmentVariable(named = "SITECRAWL_API_KEY", matches = ".*\\S.*")
    void testScrapeSitecrawlDocs() {
        System.out.println("\n=== Testing Sitecrawl Documentation ===\n");
        System.out.println("Scraping: https://docs.sitecrawl.dev");
        
        Document doc = client.scrape("https://docs.sitecrawl.dev",
                ScrapeOptions.builder()
                        .formats(List.of("markdown"))
                        .waitFor(2000)  // Wait for docs to load
                        .build());

        // Assertions
        assertNotNull(doc, "Document should not be null");
        assertNotNull(doc.getMarkdown(), "Markdown content should not be null");
        assertFalse(doc.getMarkdown().isEmpty(), "Markdown should not be empty");
        
        String markdown = doc.getMarkdown().toLowerCase();
        assertTrue(markdown.contains("document") || markdown.contains("api") || markdown.contains("sitecrawl"),
                "Docs should contain documentation content");
        
        System.out.println("✓ Successfully scraped documentation!");
        System.out.println("  Content length: " + doc.getMarkdown().length() + " characters");
        System.out.println("  Source: " + doc.getMetadata().get("sourceURL"));
        
        System.out.println("\n=== All Sitecrawl.dev tests passed! ===\n");
    }
}
