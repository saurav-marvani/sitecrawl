// Lightweight integration test for computeAndPersistPageDiff's judge-gating
// behavior. Mocks judgeChange (so no real LLM call), getJobFromGCS, and the
// GCS save sidecar so we can drive status transitions deterministically.

const mockJudge: jest.Mock<any, any> = jest.fn();
const mockSave: jest.Mock<any, any> = jest.fn(
  async () => ({ textBytes: 1, jsonBytes: 1 }),
);
const mockGetJob: jest.Mock<any, any> = jest.fn();

jest.mock("uuid", () => ({ v7: () => "test-uuid" }));

jest.mock("./judgeChange", () => ({
  judgeChange: (args: any) => mockJudge(args),
}));

jest.mock("../../lib/gcs-jobs", () => ({
  getJobFromGCS: (id: any) => mockGetJob(id),
}));

jest.mock("../../lib/gcs-monitoring", () => ({
  saveMonitorDiffArtifact: (key: any, artifact: any) => mockSave(key, artifact),
  monitorDiffGcsKey: () => "fake-gcs-key",
}));

import { computeAndPersistPageDiff } from "./diff-orchestrator";

const FAKE_JUDGMENT = {
  meaningful: true as const,
  confidence: "high" as const,
  reason: "test",
  fields: [],
};

const FRESH_PAGE = {
  teamId: "team-1",
  monitorId: "monitor-1",
  checkId: "check-1",
  url: "https://example.com",
  scrapeId: "scrape-2",
};

beforeEach(() => {
  mockJudge.mockReset();
  mockSave.mockClear();
  mockGetJob.mockReset();
});

describe("computeAndPersistPageDiff — judge gating", () => {
  it("does not call judge when previous is null (status=new)", async () => {
    const result = await computeAndPersistPageDiff({
      ...FRESH_PAGE,
      doc: { markdown: "hello world" },
      previous: null,
      formats: ["markdown"],
      goal: "track anything",
    });
    expect(result.status).toBe("new");
    expect(result.judgment).toBeUndefined();
    expect(mockJudge).not.toHaveBeenCalled();
  });

  it("does not call judge when goal is null even on a changed page", async () => {
    mockGetJob.mockResolvedValue([{ markdown: "previous content here" }]);
    mockJudge.mockResolvedValue(FAKE_JUDGMENT);
    const result = await computeAndPersistPageDiff({
      ...FRESH_PAGE,
      doc: { markdown: "current content here — totally different" },
      previous: { last_scrape_id: "scrape-1", is_removed: false },
      formats: ["markdown"],
      goal: null,
    });
    expect(result.status).toBe("changed");
    expect(result.judgment).toBeUndefined();
    expect(mockJudge).not.toHaveBeenCalled();
  });

  it("does not call judge when content is unchanged (status=same)", async () => {
    const identical = "identical text";
    mockGetJob.mockResolvedValue([{ markdown: identical }]);
    const result = await computeAndPersistPageDiff({
      ...FRESH_PAGE,
      doc: { markdown: identical },
      previous: { last_scrape_id: "scrape-1", is_removed: false },
      formats: ["markdown"],
      goal: "track anything",
    });
    expect(result.status).toBe("same");
    expect(result.judgment).toBeUndefined();
    expect(mockJudge).not.toHaveBeenCalled();
  });

  it("calls judge with markdown diff when goal is set and page changed", async () => {
    mockGetJob.mockResolvedValue([{ markdown: "old content" }]);
    mockJudge.mockResolvedValue(FAKE_JUDGMENT);
    const result = await computeAndPersistPageDiff({
      ...FRESH_PAGE,
      doc: { markdown: "new content totally different" },
      previous: { last_scrape_id: "scrape-1", is_removed: false },
      formats: ["markdown"],
      goal: "tell me when the content changes",
      extractionPrompt: "extract the heading",
    });
    expect(result.status).toBe("changed");
    expect(result.judgment).toEqual(FAKE_JUDGMENT);
    expect(mockJudge).toHaveBeenCalledTimes(1);
    const callArgs = mockJudge.mock.calls[0][0];
    expect(callArgs.goal).toBe("tell me when the content changes");
    expect(callArgs.extractionPrompt).toBe("extract the heading");
    expect(callArgs.markdownDiff).toBeDefined();
    expect(callArgs.markdownDiff.previous).toBe("old content");
    expect(callArgs.markdownDiff.current).toBe("new content totally different");
  });

  it("returns no judgment if judge throws", async () => {
    mockGetJob.mockResolvedValue([{ markdown: "old content" }]);
    mockJudge.mockRejectedValue(new Error("gemini down"));
    const result = await computeAndPersistPageDiff({
      ...FRESH_PAGE,
      doc: { markdown: "new content" },
      previous: { last_scrape_id: "scrape-1", is_removed: false },
      formats: ["markdown"],
      goal: "track anything",
    });
    expect(result.status).toBe("changed");
    expect(result.judgment).toBeUndefined();
  });
});
