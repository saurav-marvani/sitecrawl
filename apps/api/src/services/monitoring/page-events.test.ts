import { derivePageWebhookEvents } from "./page-events";

describe("derivePageWebhookEvents", () => {
  it("always includes monitor.page for any status", () => {
    for (const status of ["new", "changed", "same", "removed", "error"]) {
      expect(derivePageWebhookEvents(status, null)).toContain("monitor.page");
    }
  });

  it("does not add meaningful event when no judgment", () => {
    const events = derivePageWebhookEvents("changed", null);
    expect(events).toEqual(["monitor.page"]);
  });

  it("adds monitor.page.meaningful when judgment.meaningful is true and status is changed", () => {
    const events = derivePageWebhookEvents("changed", { meaningful: true });
    expect(events).toContain("monitor.page");
    expect(events).toContain("monitor.page.meaningful");
  });

  it("does NOT add meaningful event when judgment.meaningful is false", () => {
    const events = derivePageWebhookEvents("changed", { meaningful: false });
    expect(events).toEqual(["monitor.page"]);
  });

  it("does NOT add meaningful event for non-changed statuses even with meaningful judgment", () => {
    for (const status of ["new", "same", "removed", "error"]) {
      const events = derivePageWebhookEvents(status, { meaningful: true });
      expect(events).toEqual(["monitor.page"]);
    }
  });

  it("backwards-compat: every event set always contains monitor.page", () => {
    for (const status of ["new", "changed", "same", "removed", "error"]) {
      for (const judgment of [
        null,
        { meaningful: true },
        { meaningful: false },
      ]) {
        const fired = derivePageWebhookEvents(status, judgment);
        expect(fired).toContain("monitor.page");
      }
    }
  });
});
