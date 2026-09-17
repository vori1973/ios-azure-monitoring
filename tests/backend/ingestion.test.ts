import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import {
  toIngestedEvent,
  type RecommendationEvent,
} from "../../src/shared/contracts.js";
import {
  AzureLogsIngestionAdapter,
  IngestionError,
  LocalFileIngestionAdapter,
  RetryingIngestionAdapter,
  type IngestionAdapter,
} from "../../src/backend/ingestion.js";

const record = toIngestedEvent({
  eventType: "RecommendationGenerated",
  schemaVersion: "1.0",
  eventId: randomUUID(),
  eventTime: new Date().toISOString(),
  correlationId: randomUUID(),
  clientSessionId: randomUUID(),
  applicationVersion: "1.0.0",
  outcome: "Succeeded",
  durationMs: 42,
} satisfies RecommendationEvent);

describe("ingestion adapters", () => {
  it("writes only the closed local record", async () => {
    const directory = await mkdtemp(join(tmpdir(), "telemetry-events-"));
    const path = join(directory, "events.ndjson");
    await new LocalFileIngestionAdapter(path).upload([record]);
    expect(JSON.parse(await readFile(path, "utf8"))).toEqual(record);
    await rm(directory, { recursive: true });
  });

  it("passes configured Azure identifiers to the SDK transport", async () => {
    const upload = vi.fn(async () => undefined);
    await new AzureLogsIngestionAdapter(
      "https://example.test",
      "dcr-id",
      "Custom-Stream",
      upload,
    ).upload([record]);
    expect(upload).toHaveBeenCalledWith("dcr-id", "Custom-Stream", [record]);
  });

  it("retries retryable failures and succeeds", async () => {
    const upload = vi
      .fn<IngestionAdapter["upload"]>()
      .mockRejectedValueOnce(new IngestionError("temporary", true))
      .mockResolvedValue(undefined);
    const adapter: IngestionAdapter = {
      upload,
      readiness: async () => ({ ready: true }),
    };
    await new RetryingIngestionAdapter(
      adapter,
      3,
      async () => undefined,
    ).upload([record]);
    expect(upload).toHaveBeenCalledTimes(2);
  });

  it("does not retry a non-retryable rejection", async () => {
    const upload = vi
      .fn<IngestionAdapter["upload"]>()
      .mockRejectedValue(new IngestionError("rejected", false));
    const adapter: IngestionAdapter = {
      upload,
      readiness: async () => ({ ready: true }),
    };
    await expect(
      new RetryingIngestionAdapter(adapter, 3, async () => undefined).upload([
        record,
      ]),
    ).rejects.toThrow("rejected");
    expect(upload).toHaveBeenCalledTimes(1);
  });
});
