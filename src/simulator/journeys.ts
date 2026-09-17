import { randomUUID } from "node:crypto";

import {
  context,
  propagation,
  SpanStatusCode,
  type Tracer,
} from "@opentelemetry/api";

import { createCorrelationId } from "../shared/correlation.js";
import type { RecommendationEvent } from "../shared/contracts.js";

export type JourneyName =
  | "success"
  | "handled-exception"
  | "dependency-failure"
  | "sensitive-event"
  | "unknown-event"
  | "throttling";

type JourneyOptions = {
  gatewayUrl: string;
  token: string;
  tracer: Tracer;
  fetcher?: typeof fetch;
};

export type JourneyResult = {
  journey: JourneyName;
  correlationId: string;
  traceId: string;
  status: number;
  expected: boolean;
};

function event(correlationId: string): RecommendationEvent {
  return {
    eventType: "RecommendationGenerated",
    schemaVersion: "1.0",
    eventId: randomUUID(),
    eventTime: new Date().toISOString(),
    correlationId,
    clientSessionId: randomUUID(),
    applicationVersion: "1.0.0",
    outcome: "Succeeded",
    durationMs: 42,
  };
}

export async function runJourney(
  journey: JourneyName,
  options: JourneyOptions,
): Promise<JourneyResult> {
  const fetcher = options.fetcher ?? fetch;
  const correlationId = createCorrelationId();

  return options.tracer.startActiveSpan(
    `poc.simulator.${journey}`,
    async (span) => {
      span.setAttribute("correlation.id", correlationId);
      const carrier: Record<string, string> = {};
      propagation.inject(context.active(), carrier);
      const traceId = span.spanContext().traceId;
      const headers = {
        authorization: `Bearer ${options.token}`,
        "content-type": "application/json",
        "x-correlation-id": correlationId,
        ...carrier,
      };

      try {
        if (journey === "handled-exception") {
          try {
            throw new Error("simulated handled client exception");
          } catch (error) {
            span.recordException(error as Error);
            span.setAttribute("exception.handled", true);
          }
          return { journey, correlationId, traceId, status: 0, expected: true };
        }

        if (journey === "dependency-failure") {
          const response = await fetcher(
            `${options.gatewayUrl}/api/dependency?mode=fail`,
            {
              headers,
            },
          );
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: "expected dependency failure",
          });
          return {
            journey,
            correlationId,
            traceId,
            status: response.status,
            expected: response.status === 502,
          };
        }

        const payload: Record<string, unknown> = event(correlationId);
        if (journey === "sensitive-event")
          payload.email = "rejected@example.test";
        if (journey === "unknown-event") payload.eventType = "UnknownEvent";

        if (journey === "throttling") {
          const responses = await Promise.all(
            Array.from({ length: 8 }, () =>
              fetcher(`${options.gatewayUrl}/api/events`, {
                method: "POST",
                headers,
                body: JSON.stringify(payload),
              }),
            ),
          );
          const status = responses.some(({ status }) => status === 429)
            ? 429
            : responses.at(-1)!.status;
          return {
            journey,
            correlationId,
            traceId,
            status,
            expected: status === 429,
          };
        }

        const response = await fetcher(`${options.gatewayUrl}/api/events`, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
        });
        const expectedStatus = journey === "success" ? 202 : 400;
        if (response.status !== expectedStatus) {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: `unexpected status ${response.status}`,
          });
        }
        return {
          journey,
          correlationId,
          traceId,
          status: response.status,
          expected: response.status === expectedStatus,
        };
      } finally {
        span.end();
      }
    },
  );
}
