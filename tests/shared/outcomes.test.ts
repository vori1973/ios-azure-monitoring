import { describe, expect, it } from "vitest";

import { outcomeDefinitions } from "../../src/shared/outcomes.js";

describe("outcome definitions", () => {
  it("uses distinct status and code pairs", () => {
    const pairs = Object.values(outcomeDefinitions).map(
      ({ status, code }) => `${status}:${code}`,
    );
    expect(new Set(pairs).size).toBe(pairs.length);
  });
});
