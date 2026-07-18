using System.Text.Json.Serialization;

namespace Sitecrawl.Models;

/// <summary>
/// Response from starting an async crawl job.
/// </summary>
public class CrawlResponse
{
    [JsonPropertyName("success")]
    public bool Success { get; set; }

    [JsonPropertyName("id")]
    public string? Id { get; set; }

    [JsonPropertyName("url")]
    public string? Url { get; set; }
}
