import { describe, expect, it } from "vitest";

import {
  findSensitiveData,
  sanitizeTelemetryAttributes,
} from "../../src/shared/sanitize.js";

describe("sensitive data controls", () => {
  it("reports paths without returning prohibited values", () => {
    const findings = findSensitiveData({
      authorization: "Bearer example-value",
      profile: { email: "person@example.test" },
    });
    expect(findings).toEqual([
      { path: "$.authorization", reason: "forbidden-key" },
      { path: "$.profile.email", reason: "forbidden-key" },
    ]);
    expect(JSON.stringify(findings)).not.toContain("example-value");
    expect(JSON.stringify(findings)).not.toContain("person@example.test");
  });

  it("keeps only approved scalar telemetry attributes", () => {
    expect(
      sanitizeTelemetryAttributes({
        "event.type": "RecommendationGenerated",
        "correlation.id": "opaque",
        payload: { secret: "hidden" },
      }),
    ).toEqual({
      "event.type": "RecommendationGenerated",
      "correlation.id": "opaque",
    });
  });
});
