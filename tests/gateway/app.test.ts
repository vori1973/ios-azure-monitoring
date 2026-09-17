import { afterEach, describe, expect, it, vi } from "vitest";

import { buildGateway } from "../../src/gateway/app.js";
import type { AppConfig } from "../../src/shared/config.js";

const config = {
  POC_MODE: "local",
  BACKEND_HOST: "127.0.0.1",
  BACKEND_PORT: 3001,
  GATEWAY_HOST: "127.0.0.1",
  GATEWAY_PORT: 3000,
  BACKEND_URL: "http://backend.test",
  GATEWAY_URL: "http://gateway.test",
  LOCAL_AUTH_TOKEN: "local-demo-token-value",
  LOCAL_INGESTION_PATH: ".local-data/test.ndjson",
  OTEL_EXPORTER_OTLP_ENDPOINT: "http://collector.test:4318",
  OTEL_EXPORTER_OTLP_HEADERS: "",
  OTEL_SERVICE_NAME: "test",
  APIM_TRUST_HEADER_NAME: "x-apim-authenticated",
} satisfies AppConfig;

const apps: Awaited<ReturnType<typeof buildGateway>>[] = [];
afterEach(async () => {
  for (const app of apps.splice(0)) await app.close();
});

describe("local gateway", () => {
  it("rejects missing authentication", async () => {
    const app = await buildGateway(config, { fetcher: vi.fn() });
    apps.push(app);
    expect((await app.inject("/api/dependency")).statusCode).toBe(401);
  });

  it("forwards trace context and strips unrelated headers", async () => {
    const fetcher: typeof fetch = vi.fn(
      async () => new Response("{}", { status: 200 }),
    );
    const app = await buildGateway(config, { fetcher });
    apps.push(app);
    const response = await app.inject({
      method: "GET",
      url: "/api/dependency?mode=success",
      headers: {
        authorization: `Bearer ${config.LOCAL_AUTH_TOKEN}`,
        traceparent: "00-0123456789abcdef0123456789abcdef-0123456789abcdef-01",
        cookie: "must-not-forward",
      },
    });
    expect(response.statusCode).toBe(200);
    const forwarded = vi.mocked(fetcher).mock.calls[0]![1]!.headers as Record<
      string,
      string
    >;
    expect(forwarded.traceparent).toMatch(/^00-/);
    expect(forwarded).not.toHaveProperty("cookie");
  });

  it("throttles repeated requests", async () => {
    const fetcher: typeof fetch = vi.fn(
      async () => new Response("{}", { status: 200 }),
    );
    const app = await buildGateway(config, { fetcher });
    apps.push(app);
    const responses = await Promise.all(
      Array.from({ length: 8 }, () =>
        app.inject({
          method: "GET",
          url: "/api/dependency",
          headers: { authorization: `Bearer ${config.LOCAL_AUTH_TOKEN}` },
        }),
      ),
    );
    expect(responses.some(({ statusCode }) => statusCode === 429)).toBe(true);
  });
});
