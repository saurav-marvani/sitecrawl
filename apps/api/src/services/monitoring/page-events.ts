export interface PageJudgmentForEvents {
  meaningful: boolean;
}

export function derivePageWebhookEvents(
  status: string,
  judgment: PageJudgmentForEvents | null,
): string[] {
  const events: string[] = ["monitor.page"];
  if (status === "changed" && judgment?.meaningful === true) {
    events.push("monitor.page.meaningful");
  }
  return events;
}
