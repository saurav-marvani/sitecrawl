using System.Text.Json.Serialization;

namespace Sitecrawl.Models;

/// <summary>
/// Geolocation configuration for requests.
/// </summary>
public class LocationConfig
{
    [JsonPropertyName("country")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Country { get; set; }

    [JsonPropertyName("languages")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public List<string>? Languages { get; set; }
}
