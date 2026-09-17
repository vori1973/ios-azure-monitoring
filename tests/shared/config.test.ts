import { describe, expect, it } from "vitest";

import { loadConfig } from "../../src/shared/config.js";

const localEnvironment = {
  POC_MODE: "local",
  LOCAL_AUTH_TOKEN: "local-demo-token-value",
  OTEL_EXPORTER_OTLP_ENDPOINT: "http://localhost:4318",
};

describe("loadConfig", () => {
  it("loads local mode without Azure settings", () => {
    expect(loadConfig(localEnvironment).POC_MODE).toBe("local");
  });

  it("rejects incomplete Azure mode instead of falling back", () => {
    expect(() =>
      loadConfig({ ...localEnvironment, POC_MODE: "azure" }),
    ).toThrow(/Azure mode is missing required configuration/);
  });
});
