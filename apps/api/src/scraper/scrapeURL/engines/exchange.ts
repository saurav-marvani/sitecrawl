import { z } from "zod";

import { Meta } from "..";
import { EngineScrapeResult } from ".";
import { config } from "../../../config";
import {
  getExchangeRequestLogContext,
  getExchangeResponseLogContext,
} from "../../../lib/exchange";
import { setSpanAttributes, withSpan } from "../../../lib/otel-tracer";
import { robustFetch } from "../lib/fetch";
import { EngineError } from "../error";

const exchangeScrapeResponseSchema = z.union([
  z
    .object({
      success: z.literal(true),
      accessEventId: z.string().optional(),
      creditsCost: z.number().int().nonnegative().catch(0),
      data: z
        .object({
          url: z.string().optional(),
          title: z.string().optional(),
          description: z.string().optional(),
          source: z
            .object({
              provider: z.string().optional(),
            })
            .passthrough()
            .optional(),
          metadata: z.record(z.string(), z.unknown()).optional(),
          markdown: z.string().optional(),
          json: z.unknown().optional(),
        })
        .passthrough(),
    })
    .passthrough(),
  z
    .object({
      success: z.literal(false),
      error: z
        .object({
          code: z.string().optional(),
          message: z.string().optional(),
        })
        .passthrough()
        .optional(),
    })
    .passthrough(),
]);

export function exchangeMaxReasonableTime(meta: Meta): number {
  return meta.options.timeout ?? 60_000;
}

export async function scrapeURLWithExchange(
  meta: Meta,
): Promise<EngineScrapeResult> {
  return withSpan("engine.exchange.scrape", async span => {
    const startTime = Date.now();
    const url = meta.rewrittenUrl ?? meta.url;
    const requestLogContext = getExchangeRequestLogContext(url);
    const logger = meta.logger.child({ method: "scrapeURLWithExchange" });

    setSpanAttributes(span, {
      "engine.type": "exchange",
      "engine.url": url,
      "engine.team_id": meta.internalOptions.teamId,
    });

    logger.info("Exchange scrape started", {
      ...requestLogContext,
      scrapeId: meta.id,
      teamId: meta.internalOptions.teamId,
      maxAge: meta.options.maxAge,
    });

    try {
      const response = await robustFetch({
        url: `${config.EXCHANGE_URL!.replace(/\/+$/, "")}/v1/scrape`,
        method: "POST",
        body: {
          requestId: meta.id,
          teamId: meta.internalOptions.teamId,
          url,
          formats: ["markdown", "json"],
          ...(meta.options.maxAge === undefined
            ? {}
            : { maxAge: meta.options.maxAge }),
        },
        logger: logger.child({ method: "exchangeScrape/robustFetch" }),
        tryCount: 2,
        ignoreFailureStatus: true,
        mock: meta.mock,
        abort: meta.abort.asSignal(),
        schema: exchangeScrapeResponseSchema,
      });

      if (!response.success) {
        logger.warn("Exchange scrape failed", {
          ...requestLogContext,
          scrapeId: meta.id,
          teamId: meta.internalOptions.teamId,
          errorCode: response.error?.code,
          durationMs: Date.now() - startTime,
        });
        throw new EngineError("Exchange request failed");
      }

      const responseLogContext = getExchangeResponseLogContext(
        response.data.metadata,
      );

      logger.info("Exchange scrape completed", {
        ...requestLogContext,
        ...responseLogContext,
        scrapeId: meta.id,
        teamId: meta.internalOptions.teamId,
        integrationId: response.data.source?.provider,
        accessEventId: response.accessEventId,
        creditsCost: response.creditsCost,
        durationMs: Date.now() - startTime,
      });

      setSpanAttributes(span, {
        "exchange.integration_id": response.data.source?.provider,
        "exchange.credits_cost": response.creditsCost,
        "exchange.cache_state": responseLogContext.cacheState,
        "exchange.cache_age_ms": responseLogContext.cacheAgeMs,
        "exchange.duration_ms": Date.now() - startTime,
      });

      return {
        url: response.data.url ?? url,
        html: "",
        markdown: response.data.markdown,
        json: response.data.json,
        statusCode: 200,
        contentType: "text/markdown",
        proxyUsed: "basic",
        exchange: {
          handled: true,
          creditsCost: response.creditsCost,
          ...(response.accessEventId === undefined
            ? {}
            : { accessEventId: response.accessEventId }),
          ...(response.data.source?.provider === undefined
            ? {}
            : { integrationId: response.data.source.provider }),
        },
      };
    } catch (error) {
      logger.warn("Exchange scrape errored", {
        ...requestLogContext,
        scrapeId: meta.id,
        teamId: meta.internalOptions.teamId,
        durationMs: Date.now() - startTime,
        errorMessage: error instanceof Error ? error.message : String(error),
        error,
      });
      throw error;
    }
  });
}
