import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  ingestedEventSchema,
  recommendationEventSchema,
  toIngestedEvent,
} from "../../src/shared/contracts.js";

const validEvent = {
  eventType: "RecommendationGenerated",
  schemaVersion: "1.0",
  eventId: randomUUID(),
  eventTime: new Date().toISOString(),
  correlationId: randomUUID(),
  clientSessionId: randomUUID(),
  applicationVersion: "1.0.0",
  outcome: "Succeeded",
  durationMs: 42,
} as const;

describe("RecommendationGenerated contract", () => {
  it("accepts and maps the closed schema", () => {
    const event = recommendationEventSchema.parse(validEvent);
    expect(ingestedEventSchema.parse(toIngestedEvent(event))).toMatchObject({
      EventType: "RecommendationGenerated",
      IngestionSource: "governed-backend",
    });
  });

  it("rejects unknown properties and invalid bounds", () => {
    expect(() =>
      recommendationEventSchema.parse({
        ...validEvent,
        email: "person@example.test",
      }),
    ).toThrow();
    expect(() =>
      recommendationEventSchema.parse({ ...validEvent, durationMs: 300_001 }),
    ).toThrow();
  });
});
