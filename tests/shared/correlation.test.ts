import { describe, expect, it } from "vitest";

import {
  createCorrelationId,
  createTraceparent,
  parseCorrelationId,
  parseTraceparent,
} from "../../src/shared/correlation.js";

describe("correlation helpers", () => {
  it("creates valid opaque and W3C identifiers", () => {
    expect(parseCorrelationId(createCorrelationId())).toBeTypeOf("string");
    expect(parseTraceparent(createTraceparent())).toMatch(/^00-/);
  });

  it("rejects malformed identifiers", () => {
    expect(() => parseCorrelationId("short")).toThrow();
    expect(() => parseTraceparent("not-a-trace")).toThrow();
  });
});
