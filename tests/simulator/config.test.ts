import { describe, expect, it } from "vitest";

import { loadSimulatorConfig } from "../../src/simulator/config.js";

describe("simulator configuration", () => {
  it("requires only client-side settings in Azure mode", () => {
    const config = loadSimulatorConfig({
      POC_MODE: "azure",
      GATEWAY_URL: "https://gateway.example.test",
      LOCAL_AUTH_TOKEN: "external-client-token",
      OTEL_EXPORTER_OTLP_ENDPOINT: "https://gateway.example.test",
      OTEL_EXPORTER_OTLP_HEADERS: "x-otlp-token=client-token",
    });
    expect(config.POC_MODE).toBe("azure");
    expect(JSON.stringify(config)).not.toContain("DCR");
  });
});
