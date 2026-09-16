import { randomBytes, randomUUID } from "node:crypto";

import { correlationIdSchema } from "./contracts.js";

const traceparentPattern = /^00-[0-9a-f]{32}-[0-9a-f]{16}-0[01]$/;

export function createCorrelationId(): string {
  return randomUUID();
}

export function parseCorrelationId(value: unknown): string {
  return correlationIdSchema.parse(value);
}

export function createTraceparent(sampled = true): string {
  return `00-${randomBytes(16).toString("hex")}-${randomBytes(8).toString("hex")}-${sampled ? "01" : "00"}`;
}

export function parseTraceparent(value: unknown): string {
  if (typeof value !== "string" || !traceparentPattern.test(value)) {
    throw new Error("Invalid W3C traceparent");
  }
  return value;
}
