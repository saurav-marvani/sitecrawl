using System.Text.Json.Serialization;

namespace Sitecrawl.Models;

/// <summary>
/// Question format specification for use in ScrapeOptions.Formats.
/// </summary>
public class QuestionFormat
{
    [JsonPropertyName("type")]
    public string Type { get; } = "question";

    [JsonPropertyName("question")]
    public required string Question { get; set; }
}
