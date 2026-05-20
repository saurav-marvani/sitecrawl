import { judgeChange } from "./judgeChange";
import { logger as winstonLogger } from "../../lib/logger";

const HAS_GEMINI = !!process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const describeIfGemini = HAS_GEMINI ? describe : describe.skip;

function buildLogger() {
  return winstonLogger.child({ test: "judgeChange" });
}

const TEST_TIMEOUT = 30000;

describe("judgeChange — input validation (no LLM call)", () => {
  it("returns low-confidence meaningful when no diff payload is provided", async () => {
    const result = await judgeChange({
      logger: buildLogger(),
      goal: "anything",
    });
    expect(result.meaningful).toBe(true);
    expect(result.confidence).toBe("low");
    expect(result.reason).toMatch(/no diff payload/i);
    expect(result.fields).toEqual([]);
  });
});

describeIfGemini("judgeChange — JSON-mode diffs (live Gemini)", () => {
  it(
    "classifies whitespace-only field change as noise",
    async () => {
      const result = await judgeChange({
        logger: buildLogger(),
        goal: "Track the page heading verbatim",
        jsonDiff: {
          headline: {
            previous: "Power AI agents with clean web data",
            current: "Power AI agents with  clean web data",
          },
        },
      });
      expect(result.meaningful).toBe(false);
      expect(["high", "medium"]).toContain(result.confidence);
    },
    TEST_TIMEOUT,
  );

  it(
    "classifies real price change as meaningful when goal matches",
    async () => {
      const result = await judgeChange({
        logger: buildLogger(),
        goal: "Monitor the Pro tier price",
        jsonDiff: {
          pro_price: { previous: "$19/mo", current: "$24/mo" },
        },
      });
      expect(result.meaningful).toBe(true);
      expect(["high", "medium"]).toContain(result.confidence);
      expect(result.fields).toContain("pro_price");
    },
    TEST_TIMEOUT,
  );

  it(
    "classifies timestamp drift as noise",
    async () => {
      const result = await judgeChange({
        logger: buildLogger(),
        goal: "track new product additions",
        jsonDiff: {
          updated_at: {
            previous: "2026-05-19T18:42:00Z",
            current: "2026-05-19T18:43:01Z",
          },
        },
      });
      expect(result.meaningful).toBe(false);
    },
    TEST_TIMEOUT,
  );

  it(
    "named-field rule: sub-1% price change is meaningful when goal names 'price'",
    async () => {
      const result = await judgeChange({
        logger: buildLogger(),
        goal: "Track the Pro tier price. Tell me about ANY price change.",
        jsonDiff: {
          pro_price: { previous: "$19.00", current: "$19.01" },
        },
      });
      // Without named-field rule, 0.05% would be classified as noise.
      // With the rule, "price" is named so any change is meaningful.
      expect(result.meaningful).toBe(true);
    },
    TEST_TIMEOUT,
  );

  it(
    "named-field rule does NOT apply to unmentioned fields",
    async () => {
      const result = await judgeChange({
        logger: buildLogger(),
        goal: "Track the Pro tier price.",
        // view_count is not named in the goal; should fall under the 1% rule
        jsonDiff: {
          view_count: { previous: "12402", current: "12418" },
        },
      });
      expect(result.meaningful).toBe(false);
    },
    TEST_TIMEOUT,
  );

  it(
    "consults the goal — on-goal diff is meaningful with high confidence",
    async () => {
      const diff = {
        products: {
          previous: ["MacBook Air M2", "MacBook Pro M3"],
          current: ["MacBook Air M4", "MacBook Air M2", "MacBook Pro M3"],
        },
      };
      const onGoal = await judgeChange({
        logger: buildLogger(),
        goal: "tell me when a new MacBook is announced",
        jsonDiff: diff,
      });
      expect(onGoal.meaningful).toBe(true);
      expect(["high", "medium"]).toContain(onGoal.confidence);
      // Reason should mention what triggered the call — proves the diff
      // was actually inspected, not just defaulted.
      expect(onGoal.reason.toLowerCase()).toMatch(/macbook|product|new/);
    },
    TEST_TIMEOUT,
  );
});

describeIfGemini("judgeChange — markdown-mode diffs (live Gemini)", () => {
  it(
    "classifies new list item in markdown as meaningful",
    async () => {
      const result = await judgeChange({
        logger: buildLogger(),
        goal: "tell me when a new MacBook is announced",
        markdownDiff: {
          previous:
            "# MacBook lineup\n- MacBook Air M2\n- MacBook Pro M3\n\nUpdated 2026-05-19T18:42:00Z",
          current:
            "# MacBook lineup\n- MacBook Air M4 — NEW\n- MacBook Air M2\n- MacBook Pro M3\n\nUpdated 2026-05-19T18:43:01Z",
          diffText:
            "@@ -1,4 +1,5 @@\n # MacBook lineup\n+- MacBook Air M4 — NEW\n - MacBook Air M2\n - MacBook Pro M3\n \n-Updated 2026-05-19T18:42:00Z\n+Updated 2026-05-19T18:43:01Z",
        },
      });
      expect(result.meaningful).toBe(true);
    },
    TEST_TIMEOUT,
  );

  it(
    "classifies timestamp-only markdown change as noise",
    async () => {
      const result = await judgeChange({
        logger: buildLogger(),
        goal: "tell me when new SEC filings appear",
        markdownDiff: {
          previous:
            "# SEC Filings\n10-K filed 2025-01\n10-Q filed 2025-04\n\nLast viewed 2026-05-19T18:42:00Z",
          current:
            "# SEC Filings\n10-K filed 2025-01\n10-Q filed 2025-04\n\nLast viewed 2026-05-19T18:43:01Z",
          diffText:
            "@@ -3,4 +3,4 @@\n 10-Q filed 2025-04\n \n-Last viewed 2026-05-19T18:42:00Z\n+Last viewed 2026-05-19T18:43:01Z",
        },
      });
      expect(result.meaningful).toBe(false);
    },
    TEST_TIMEOUT,
  );
});
