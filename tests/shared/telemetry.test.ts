import { describe, expect, it } from "vitest";

import { createTelemetry } from "../../src/shared/telemetry.js";

describe("controlled telemetry export", () => {
  it("reports an unavailable OTLP endpoint", async () => {
    const telemetry = createTelemetry(
      "export-failure-test",
      "http://127.0.0.1:1",
    );
    telemetry.tracer.startSpan("expected-export-failure").end();
    await expect(telemetry.shutdown()).rejects.toThrow();
    expect(telemetry.exportErrorCount()).toBeGreaterThan(0);
  });
});
