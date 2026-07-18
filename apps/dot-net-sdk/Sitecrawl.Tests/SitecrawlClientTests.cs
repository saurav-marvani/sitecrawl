using Sitecrawl.Exceptions;
using Sitecrawl.Models;
using Xunit;

namespace Sitecrawl.Tests;

public class SitecrawlClientTests
{
    [Fact]
    public void Constructor_AllowsEmptyApiKey_ForKeylessFreeTier()
    {
        // Clear env variable in case it's set
        Environment.SetEnvironmentVariable("SITECRAWL_API_KEY", null);

        // No key: scrape/search use the keyless free tier; no longer throws.
        var client = new SitecrawlClient(apiKey: "");
        Assert.NotNull(client);
    }

    [Fact]
    public void Constructor_AllowsNullApiKey_ForKeylessFreeTier()
    {
        Environment.SetEnvironmentVariable("SITECRAWL_API_KEY", null);

        var client = new SitecrawlClient(apiKey: null);
        Assert.NotNull(client);
    }

    [Fact]
    public void Constructor_AcceptsApiKey()
    {
        var client = new SitecrawlClient(apiKey: "fc-test-key");
        Assert.NotNull(client);
    }

    [Fact]
    public void Constructor_AcceptsCustomHttpClient()
    {
        var httpClient = new HttpClient { Timeout = TimeSpan.FromSeconds(10) };

        var client = new SitecrawlClient(
            apiKey: "fc-test-key",
            httpClient: httpClient);
        Assert.NotNull(client);
    }

    [Fact]
    public void Constructor_AcceptsCustomApiUrl()
    {
        var client = new SitecrawlClient(
            apiKey: "fc-test-key",
            apiUrl: "https://custom-api.sitecrawl.dev");
        Assert.NotNull(client);
    }

    [Fact]
    public void Constructor_ReadsFromEnvironmentVariable()
    {
        Environment.SetEnvironmentVariable("SITECRAWL_API_KEY", "fc-env-key");
        try
        {
            var client = new SitecrawlClient();
            Assert.NotNull(client);
        }
        finally
        {
            Environment.SetEnvironmentVariable("SITECRAWL_API_KEY", null);
        }
    }

    [Fact]
    public async Task ScrapeAsync_RequiresUrl()
    {
        var client = new SitecrawlClient(apiKey: "fc-test-key");

        await Assert.ThrowsAsync<ArgumentNullException>(
            () => client.ScrapeAsync(null!));
    }

    [Fact]
    public async Task StartCrawlAsync_RequiresUrl()
    {
        var client = new SitecrawlClient(apiKey: "fc-test-key");

        await Assert.ThrowsAsync<ArgumentNullException>(
            () => client.StartCrawlAsync(null!));
    }

    [Fact]
    public async Task MapAsync_RequiresUrl()
    {
        var client = new SitecrawlClient(apiKey: "fc-test-key");

        await Assert.ThrowsAsync<ArgumentNullException>(
            () => client.MapAsync(null!));
    }

    [Fact]
    public async Task SearchAsync_RequiresQuery()
    {
        var client = new SitecrawlClient(apiKey: "fc-test-key");

        await Assert.ThrowsAsync<ArgumentNullException>(
            () => client.SearchAsync(null!));
    }

    [Fact]
    public async Task StartBatchScrapeAsync_RequiresUrls()
    {
        var client = new SitecrawlClient(apiKey: "fc-test-key");

        await Assert.ThrowsAsync<ArgumentNullException>(
            () => client.StartBatchScrapeAsync(null!));
    }

    [Fact]
    public async Task CancelCrawlAsync_RequiresJobId()
    {
        var client = new SitecrawlClient(apiKey: "fc-test-key");

        await Assert.ThrowsAsync<ArgumentNullException>(
            () => client.CancelCrawlAsync(null!));
    }

    [Fact]
    public async Task GetCrawlStatusAsync_RequiresJobId()
    {
        var client = new SitecrawlClient(apiKey: "fc-test-key");

        await Assert.ThrowsAsync<ArgumentNullException>(
            () => client.GetCrawlStatusAsync(null!));
    }
}
