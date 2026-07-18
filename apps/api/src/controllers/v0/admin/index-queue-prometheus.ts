import type { Request, Response } from "express";
import {
  getIndexInsertQueueLength,
  getOMCEQueueLength,
} from "../../../services";
import { getWebhookInsertQueueLength } from "../../../services/webhook";

export async function indexQueuePrometheus(req: Request, res: Response) {
  const queueLength = await getIndexInsertQueueLength();
  const webhookQueueLength = await getWebhookInsertQueueLength();
  const omceQueueLength = await getOMCEQueueLength();
  res.setHeader("Content-Type", "text/plain");
  res.send(`\
# HELP sitecrawl_index_queue_length The number of items in the index insert queue
# TYPE sitecrawl_index_queue_length gauge
sitecrawl_index_queue_length ${queueLength}
sitecrawl_webhook_queue_length ${webhookQueueLength}
sitecrawl_omce_queue_length ${omceQueueLength}
`);
}
