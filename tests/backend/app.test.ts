import { randomUUID } from "node:crypto";

import { trace } from "@opentelemetry/api";
import { afterEach, describe, expect, it, vi } from "vitest";

import { buildBackend } from "../../src/backend/app.js";
import {
  IngestionError,
  type IngestionAdapter,
} from "../../src/backend/ingestion.js";
import type { AppConfig } from "../../src/shared/config.js";

const config = {
  POC_MODE: "local",
  BACKEND_HOST: "127.0.0.1",
  BACKEND_PORT: 3001,
  GATEWAY_HOST: "127.0.0.1",
  GATEWAY_PORT: 3000,
  BACKEND_URL: "http://localhost:3001",
  GATEWAY_URL: "http://localhost:3000",
  LOCAL_AUTH_TOKEN: "local-demo-token-value",
  LOCAL_INGESTION_PATH: ".local-data/test.ndjson",
  OTEL_EXPORTER_OTLP_ENDPOINT: "http://localhost:4318",
  OTEL_EXPORTER_OTLP_HEADERS: "",
  OTEL_SERVICE_NAME: "test",
  APIM_TRUST_HEADER_NAME: "x-apim-authenticated",
} satisfies AppConfig;

const event = () => ({
  eventType: "RecommendationGenerated",
  schemaVersion: "1.0",
  eventId: randomUUID(),
  eventTime: new Date().toISOString(),
  correlationId: randomUUID(),
  clientSessionId: randomUUID(),
  applicationVersion: "1.0.0",
  outcome: "Succeeded",
  durationMs: 42,
});

const apps: Awaited<ReturnType<typeof buildBackend>>[] = [];
afterEach(async () => {
  for (const app of apps.splice(0)) await app.close();
});

async function appWith(adapter: IngestionAdapter) {
  const app = await buildBackend(config, {
    ingestion: adapter,
    tracer: trace.getTracer("test"),
  });
  apps.push(app);
  return app;
}

describe("governed backend", () => {
  it("rejects missing identity and accepts a valid event", async () => {
    const upload = vi.fn(async () => undefined);
    const app = await appWith({
      upload,
      readiness: async () => ({ ready: true }),
    });
    const unauthorized = await app.inject({
      method: "POST",
      url: "/api/events",
      payload: event(),
    });
    expect(unauthorized.statusCode).toBe(401);
    const accepted = await app.inject({
      method: "POST",
      url: "/api/events",
      headers: { authorization: `Bearer ${config.LOCAL_AUTH_TOKEN}` },
      payload: event(),
    });
    expect(accepted.statusCode).toBe(202);
    expect(upload).toHaveBeenCalledOnce();
  });

  it("rejects sensitive and unknown fields without ingestion", async () => {
    const upload = vi.fn(async () => undefined);
    const app = await appWith({
      upload,
      readiness: async () => ({ ready: true }),
    });

    for (const payload of [
      { ...event(), email: "person@example.test" },
      { ...event(), extra: true },
    ]) {
      const response = await app.inject({
        method: "POST",
        url: "/api/events",
        headers: { authorization: `Bearer ${config.LOCAL_AUTH_TOKEN}` },
        payload,
      });
      expect(response.statusCode).toBe(400);
    }
    expect(upload).not.toHaveBeenCalled();
  });

  it("does not ingest the same event identifier twice", async () => {
    const upload = vi.fn(async () => undefined);
    const app = await appWith({
      upload,
      readiness: async () => ({ ready: true }),
    });
    const payload = event();
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await app.inject({
        method: "POST",
        url: "/api/events",
        headers: { authorization: `Bearer ${config.LOCAL_AUTH_TOKEN}` },
        payload,
      });
      expect(response.statusCode).toBe(202);
    }
    expect(upload).toHaveBeenCalledOnce();
  });

  it("surfaces retryable and non-retryable ingestion failures distinctly", async () => {
    for (const [retryable, status] of [
      [true, 503],
      [false, 502],
    ] as const) {
      const app = await appWith({
        upload: async () => {
          throw new IngestionError("failed", retryable);
        },
        readiness: async () => ({ ready: true }),
      });
      const response = await app.inject({
        method: "POST",
        url: "/api/events",
        headers: { authorization: `Bearer ${config.LOCAL_AUTH_TOKEN}` },
        payload: event(),
      });
      expect(response.statusCode).toBe(status);
    }
  });

  it("distinguishes liveness, readiness, and dependency outcomes", async () => {
    const app = await appWith({
      upload: async () => undefined,
      readiness: async () => ({ ready: false, reason: "missing-config" }),
    });
    expect((await app.inject("/health")).statusCode).toBe(200);
    expect((await app.inject("/ready")).statusCode).toBe(503);
    expect((await app.inject("/api/dependency?mode=success")).statusCode).toBe(
      200,
    );
    expect((await app.inject("/api/dependency?mode=fail")).statusCode).toBe(
      502,
    );
    expect((await app.inject("/api/dependency?mode=timeout")).statusCode).toBe(
      504,
    );
  });
});
