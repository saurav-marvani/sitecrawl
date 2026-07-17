using System.Text.Json.Serialization;

namespace Sitecrawl.Models;

/// <summary>
/// Current concurrency usage information.
/// </summary>
public class ConcurrencyCheck
{
    [JsonPropertyName("current")]
    public int Current { get; set; }

    [JsonPropertyName("max")]
    public int MaxConcurrency { get; set; }
}
