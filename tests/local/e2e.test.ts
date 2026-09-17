import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { context, propagation, trace } from "@opentelemetry/api";
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import {
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { afterEach, describe, expect, it } from "vitest";

import { buildBackend } from "../../src/backend/app.js";
import { LocalFileIngestionAdapter } from "../../src/backend/ingestion.js";
import { buildGateway } from "../../src/gateway/app.js";
import { runJourney } from "../../src/simulator/journeys.js";
import type { AppConfig } from "../../src/shared/config.js";

const closeables: { close: () => Promise<unknown> }[] = [];
afterEach(async () => {
  for (const closeable of closeables.splice(0)) await closeable.close();
});

describe("local topology", () => {
  it("correlates accepted records and rejects prohibited events", async () => {
    const spanExporter = new InMemorySpanExporter();
    const provider = new NodeTracerProvider({
      spanProcessors: [new SimpleSpanProcessor(spanExporter)],
    });
    provider.register({
      contextManager: new AsyncLocalStorageContextManager(),
    });
    const directory = await mkdtemp(join(tmpdir(), "telemetry-e2e-"));
    const path = join(directory, "events.ndjson");
    const baseConfig = {
      POC_MODE: "local",
      BACKEND_HOST: "127.0.0.1",
      BACKEND_PORT: 3001,
      GATEWAY_HOST: "127.0.0.1",
      GATEWAY_PORT: 3000,
      BACKEND_URL: "http://127.0.0.1",
      GATEWAY_URL: "http://127.0.0.1",
      LOCAL_AUTH_TOKEN: "local-demo-token-value",
      LOCAL_INGESTION_PATH: path,
      OTEL_EXPORTER_OTLP_ENDPOINT: "http://127.0.0.1:4318",
      OTEL_EXPORTER_OTLP_HEADERS: "",
      OTEL_SERVICE_NAME: "test",
      APIM_TRUST_HEADER_NAME: "x-apim-authenticated",
    } satisfies AppConfig;
    const backend = await buildBackend(baseConfig, {
      ingestion: new LocalFileIngestionAdapter(path),
      tracer: provider.getTracer("backend-test"),
    });
    closeables.push(backend);
    await backend.listen({ host: "127.0.0.1", port: 0 });
    const backendAddress = backend.server.address();
    if (!backendAddress || typeof backendAddress === "string")
      throw new Error("No backend port");

    const gateway = await buildGateway(
      { ...baseConfig, BACKEND_URL: `http://127.0.0.1:${backendAddress.port}` },
      {},
    );
    closeables.push(gateway);
    await gateway.listen({ host: "127.0.0.1", port: 0 });
    const gatewayAddress = gateway.server.address();
    if (!gatewayAddress || typeof gatewayAddress === "string")
      throw new Error("No gateway port");
    const gatewayUrl = `http://127.0.0.1:${gatewayAddress.port}`;

    const success = await runJourney("success", {
      gatewayUrl,
      token: baseConfig.LOCAL_AUTH_TOKEN,
      tracer: provider.getTracer("simulator-test"),
    });
    const sensitive = await runJourney("sensitive-event", {
      gatewayUrl,
      token: baseConfig.LOCAL_AUTH_TOKEN,
      tracer: provider.getTracer("simulator-test"),
    });
    const unknown = await runJourney("unknown-event", {
      gatewayUrl,
      token: baseConfig.LOCAL_AUTH_TOKEN,
      tracer: provider.getTracer("simulator-test"),
    });
    const dependency = await runJourney("dependency-failure", {
      gatewayUrl,
      token: baseConfig.LOCAL_AUTH_TOKEN,
      tracer: provider.getTracer("simulator-test"),
    });
    const handled = await runJourney("handled-exception", {
      gatewayUrl,
      token: baseConfig.LOCAL_AUTH_TOKEN,
      tracer: provider.getTracer("simulator-test"),
    });
    const throttling = await runJourney("throttling", {
      gatewayUrl,
      token: baseConfig.LOCAL_AUTH_TOKEN,
      tracer: provider.getTracer("simulator-test"),
    });

    expect(
      [success, sensitive, unknown, dependency, handled, throttling].every(
        ({ expected }) => expected,
      ),
    ).toBe(true);
    const persisted = await readFile(path, "utf8");
    expect(persisted).toContain(success.correlationId);
    expect(persisted).not.toContain("rejected@example.test");
    expect(persisted.trim().split("\n")).toHaveLength(2);
    await provider.forceFlush();
    const spans = spanExporter.getFinishedSpans();
    const successSpans = spans.filter(
      ({ attributes }) =>
        attributes["correlation.id"] === success.correlationId,
    );
    expect(successSpans.map(({ name }) => name)).toEqual(
      expect.arrayContaining([
        "poc.simulator.success",
        "poc.business-event.ingest",
      ]),
    );
    expect(
      new Set(successSpans.map((span) => span.spanContext().traceId)).size,
    ).toBe(1);
    expect(
      JSON.stringify(
        spans.map(({ attributes, events, name, status }) => ({
          attributes,
          events,
          name,
          status,
        })),
      ),
    ).not.toContain("rejected@example.test");
    await provider.shutdown();
    trace.disable();
    context.disable();
    propagation.disable();
    await rm(directory, { recursive: true });
  });
});
