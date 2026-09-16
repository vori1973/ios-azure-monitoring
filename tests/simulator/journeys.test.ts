import { trace } from "@opentelemetry/api";
import { describe, expect, it, vi } from "vitest";

import { runJourney } from "../../src/simulator/journeys.js";

describe("simulator journeys", () => {
  it.each([
    ["success", 202],
    ["dependency-failure", 502],
    ["sensitive-event", 400],
    ["unknown-event", 400],
  ] as const)("reports expected %s outcome", async (journey, status) => {
    const fetcher = vi.fn(async () => new Response("{}", { status }));
    const result = await runJourney(journey, {
      gatewayUrl: "http://gateway.test",
      token: "local-demo-token-value",
      tracer: trace.getTracer("test"),
      fetcher,
    });
    expect(result).toMatchObject({ journey, status, expected: true });
    expect(fetcher).toHaveBeenCalled();
    expect(JSON.stringify(fetcher.mock.calls)).not.toContain(
      "ingest.monitor.azure.com",
    );
  });

  it("records a handled exception without failing the journey", async () => {
    const result = await runJourney("handled-exception", {
      gatewayUrl: "http://gateway.test",
      token: "local-demo-token-value",
      tracer: trace.getTracer("test"),
    });
    expect(result).toMatchObject({ status: 0, expected: true });
  });

  it("detects gateway throttling", async () => {
    const fetcher = vi.fn(async () => new Response("{}", { status: 429 }));
    const result = await runJourney("throttling", {
      gatewayUrl: "http://gateway.test",
      token: "local-demo-token-value",
      tracer: trace.getTracer("test"),
      fetcher,
    });
    expect(result).toMatchObject({ status: 429, expected: true });
  });
});
