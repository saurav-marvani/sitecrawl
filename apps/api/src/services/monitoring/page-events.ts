import { WebhookEvent } from "../webhook/types";

interface PageJudgmentForEvents {
  meaningful: boolean;
}

export function derivePageWebhookEvents(
  status: string,
  judgment: PageJudgmentForEvents | null,
): WebhookEvent[] {
  const events: WebhookEvent[] = [WebhookEvent.MONITOR_PAGE];
  if (status === "changed" && judgment?.meaningful === true) {
    events.push(WebhookEvent.MONITOR_PAGE_MEANINGFUL);
  }
  return events;
}
