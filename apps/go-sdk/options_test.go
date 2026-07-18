package sitecrawl

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestScrapeOptionsSerializesQueryFormatMode(t *testing.T) {
	payload, err := json.Marshal(ScrapeOptions{
		FormatOptions: []interface{}{
			QueryFormat{
				Prompt: "What is Sitecrawl?",
				Mode:   QueryModeDirectQuote,
			},
		},
	})
	if err != nil {
		t.Fatalf("Marshal ScrapeOptions: %v", err)
	}

	jsonBody := string(payload)
	for _, want := range []string{
		`"formats":[{"type":"query","prompt":"What is Sitecrawl?","mode":"directQuote"}]`,
	} {
		if !strings.Contains(jsonBody, want) {
			t.Fatalf("serialized query format = %s, want to contain %s", jsonBody, want)
		}
	}
}

func TestScrapeOptionsSerializesQuestionAndHighlightsFormats(t *testing.T) {
	payload, err := json.Marshal(ScrapeOptions{
		FormatOptions: []interface{}{
			QuestionFormat{Question: "What is Sitecrawl?"},
			HighlightsFormat{Query: "What is Sitecrawl?"},
		},
	})
	if err != nil {
		t.Fatalf("Marshal ScrapeOptions: %v", err)
	}

	jsonBody := string(payload)
	for _, want := range []string{
		`{"type":"question","question":"What is Sitecrawl?"}`,
		`{"type":"highlights","query":"What is Sitecrawl?"}`,
	} {
		if !strings.Contains(jsonBody, want) {
			t.Fatalf("serialized formats = %s, want to contain %s", jsonBody, want)
		}
	}
}

func TestScrapeOptionsPreservesStringFormats(t *testing.T) {
	payload, err := json.Marshal(ScrapeOptions{
		Formats: []string{"markdown", "video"},
	})
	if err != nil {
		t.Fatalf("Marshal ScrapeOptions: %v", err)
	}

	if !strings.Contains(string(payload), `"formats":["markdown","video"]`) {
		t.Fatalf("serialized string formats = %s", payload)
	}
}

func TestScrapeOptionsSerializesRedactPII(t *testing.T) {
	payload, err := json.Marshal(ScrapeOptions{
		RedactPII: Bool(true),
	})
	if err != nil {
		t.Fatalf("Marshal ScrapeOptions: %v", err)
	}

	if !strings.Contains(string(payload), `"redactPII":true`) {
		t.Fatalf("serialized redactPII = %s", payload)
	}
}

func TestSearchOptionsSerializesHighlights(t *testing.T) {
	payload, err := json.Marshal(SearchOptions{Highlights: Bool(false)})
	if err != nil {
		t.Fatalf("Marshal SearchOptions: %v", err)
	}

	if !strings.Contains(string(payload), `"highlights":false`) {
		t.Fatalf("serialized search options = %s", payload)
	}
}
