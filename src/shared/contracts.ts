import { z } from "zod";

export const correlationIdSchema = z
  .string()
  .min(16)
  .max(64)
  .regex(/^[a-zA-Z0-9-]+$/);

export const recommendationEventSchema = z
  .object({
    eventType: z.literal("RecommendationGenerated"),
    schemaVersion: z.literal("1.0"),
    eventId: z.string().uuid(),
    eventTime: z.string().datetime({ offset: true }),
    correlationId: correlationIdSchema,
    clientSessionId: z.string().uuid(),
    applicationVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
    outcome: z.enum(["Succeeded", "Failed"]),
    durationMs: z.number().int().min(0).max(300_000),
  })
  .strict();

export type RecommendationEvent = z.infer<typeof recommendationEventSchema>;

export const ingestedEventSchema = z
  .object({
    TimeGenerated: z.string().datetime({ offset: true }),
    EventType: z.literal("RecommendationGenerated"),
    SchemaVersion: z.literal("1.0"),
    EventId: z.string().uuid(),
    CorrelationId: correlationIdSchema,
    ClientSessionId: z.string().uuid(),
    ApplicationVersion: z.string(),
    Outcome: z.enum(["Succeeded", "Failed"]),
    DurationMs: z.number().int(),
    IngestionSource: z.literal("governed-backend"),
  })
  .strict();

export type IngestedEvent = z.infer<typeof ingestedEventSchema>;

export function toIngestedEvent(event: RecommendationEvent): IngestedEvent {
  return {
    TimeGenerated: event.eventTime,
    EventType: event.eventType,
    SchemaVersion: event.schemaVersion,
    EventId: event.eventId,
    CorrelationId: event.correlationId,
    ClientSessionId: event.clientSessionId,
    ApplicationVersion: event.applicationVersion,
    Outcome: event.outcome,
    DurationMs: event.durationMs,
    IngestionSource: "governed-backend",
  };
}
