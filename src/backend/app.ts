import {
  context,
  propagation,
  SpanStatusCode,
  trace,
  type Tracer,
} from "@opentelemetry/api";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyInstance } from "fastify";
import { ZodError } from "zod";

import type { AppConfig } from "../shared/config.js";
import {
  recommendationEventSchema,
  toIngestedEvent,
} from "../shared/contracts.js";
import { errorBody } from "../shared/outcomes.js";
import {
  findSensitiveData,
  sanitizeTelemetryAttributes,
} from "../shared/sanitize.js";
import {
  ApimTrustVerifier,
  AuthenticationError,
  LocalTokenVerifier,
  type AuthVerifier,
} from "./auth.js";
import {
  AzureLogsIngestionAdapter,
  IngestionError,
  LocalFileIngestionAdapter,
  RetryingIngestionAdapter,
  type IngestionAdapter,
} from "./ingestion.js";

type AppDependencies = {
  authVerifier?: AuthVerifier;
  ingestion?: IngestionAdapter;
  tracer?: Tracer;
};

export function createIngestion(config: AppConfig): IngestionAdapter {
  if (config.POC_MODE === "local") {
    return new RetryingIngestionAdapter(
      new LocalFileIngestionAdapter(config.LOCAL_INGESTION_PATH),
    );
  }
  return new RetryingIngestionAdapter(
    new AzureLogsIngestionAdapter(
      config.AZURE_LOGS_ENDPOINT!,
      config.AZURE_DCR_IMMUTABLE_ID!,
      config.AZURE_DCR_STREAM_NAME!,
    ),
  );
}

export function createAuthVerifier(config: AppConfig): AuthVerifier {
  return config.POC_MODE === "local"
    ? new LocalTokenVerifier(config.LOCAL_AUTH_TOKEN)
    : new ApimTrustVerifier(
        config.APIM_TRUST_HEADER_NAME,
        config.APIM_TRUST_HEADER_VALUE!,
      );
}

export async function buildBackend(
  config: AppConfig,
  dependencies: AppDependencies = {},
): Promise<FastifyInstance> {
  const app = Fastify({
    bodyLimit: 16 * 1024,
    logger: false,
  });
  const authVerifier = dependencies.authVerifier ?? createAuthVerifier(config);
  const ingestion = dependencies.ingestion ?? createIngestion(config);
  const tracer = dependencies.tracer ?? trace.getTracer("governed-backend");
  const acceptedEventIds = new Set<string>();

  await app.register(rateLimit, { max: 20, timeWindow: "1 minute" });

  app.get("/health", async () => ({ status: "healthy" }));
  app.get("/ready", async (_request, reply) => {
    const readiness = await ingestion.readiness();
    if (!readiness.ready) {
      return reply.code(503).send({
        status: "not-ready",
        reason: readiness.reason ?? "ingestion-unavailable",
      });
    }
    return { status: "ready", mode: config.POC_MODE };
  });

  app.get<{ Querystring: { mode?: string } }>(
    "/api/dependency",
    async (request, reply) => {
      const mode = request.query.mode ?? "success";
      return tracer.startActiveSpan("poc.backend.dependency", async (span) => {
        span.setAttributes(
          sanitizeTelemetryAttributes({
            "dependency.mode": mode,
            "correlation.id":
              request.headers["x-correlation-id"] ?? "not-provided",
          }),
        );
        try {
          if (mode === "timeout") {
            await new Promise((resolve) => setTimeout(resolve, 150));
            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: "dependency timeout",
            });
            return reply
              .code(504)
              .send({ error: { code: "dependency_timeout" } });
          }
          if (mode === "fail") {
            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: "dependency failed",
            });
            return reply
              .code(502)
              .send({ error: { code: "dependency_failed" } });
          }
          return { outcome: "succeeded" };
        } finally {
          span.end();
        }
      });
    },
  );

  app.post("/api/events", async (request, reply) => {
    const parent = propagation.extract(context.active(), request.headers);
    return context.with(parent, () =>
      tracer.startActiveSpan("poc.business-event.ingest", async (span) => {
        try {
          const client = authVerifier.verify(request.headers);
          const sensitiveFindings = findSensitiveData(request.body);
          if (sensitiveFindings.length > 0) {
            span.setAttributes(
              sanitizeTelemetryAttributes({
                "error.code": "sensitive_data_rejected",
                "http.response.status_code": 400,
              }),
            );
            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: "sensitive data rejected",
            });
            return reply
              .code(400)
              .send(
                errorBody(
                  "validation",
                  `Sensitive fields rejected: ${sensitiveFindings.map(({ path }) => path).join(", ")}`,
                ),
              );
          }

          const event = recommendationEventSchema.parse(request.body);
          span.setAttributes(
            sanitizeTelemetryAttributes({
              "event.type": event.eventType,
              "event.schema_version": event.schemaVersion,
              "event.outcome": event.outcome,
              "event.duration_ms": event.durationMs,
              "correlation.id": event.correlationId,
            }),
          );
          if (acceptedEventIds.has(event.eventId)) {
            return reply.code(202).send({
              status: "accepted",
              duplicate: true,
              eventId: event.eventId,
              correlationId: event.correlationId,
              clientId: client.clientId,
            });
          }
          acceptedEventIds.add(event.eventId);
          try {
            await ingestion.upload([toIngestedEvent(event)]);
          } catch (error) {
            acceptedEventIds.delete(event.eventId);
            throw error;
          }
          return reply.code(202).send({
            status: "accepted",
            eventId: event.eventId,
            correlationId: event.correlationId,
            clientId: client.clientId,
          });
        } catch (error) {
          if (error instanceof AuthenticationError) {
            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: "authentication failed",
            });
            return reply.code(401).send(errorBody("authentication"));
          }
          if (error instanceof ZodError) {
            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: "validation failed",
            });
            return reply
              .code(400)
              .send(
                errorBody(
                  "validation",
                  error.issues
                    .map(({ path, code }) => `${path.join(".") || "$"}:${code}`)
                    .join(", "),
                ),
              );
          }
          if (error instanceof IngestionError) {
            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: "ingestion failed",
            });
            return reply
              .code(error.retryable ? 503 : 502)
              .send(
                errorBody(error.retryable ? "retryExhausted" : "azureRejected"),
              );
          }
          request.log.error({
            errorType: error instanceof Error ? error.name : "unknown",
          });
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: "unhandled backend error",
          });
          return reply
            .code(500)
            .send({ error: { code: "internal_error", retryable: false } });
        } finally {
          span.end();
        }
      }),
    );
  });

  return app;
}
