import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

import { DefaultAzureCredential } from "@azure/identity";
import { LogsIngestionClient } from "@azure/monitor-ingestion";

import type { IngestedEvent } from "../shared/contracts.js";

export class IngestionError extends Error {
  public constructor(
    message: string,
    public readonly retryable: boolean,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

export interface IngestionAdapter {
  upload(records: IngestedEvent[]): Promise<void>;
  readiness(): Promise<{ ready: boolean; reason?: string }>;
}

export class LocalFileIngestionAdapter implements IngestionAdapter {
  public constructor(private readonly path: string) {}

  public async upload(records: IngestedEvent[]): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    await appendFile(
      this.path,
      records.map((record) => JSON.stringify(record)).join("\n") + "\n",
    );
  }

  public async readiness(): Promise<{ ready: boolean }> {
    return { ready: true };
  }
}

export type LogsUpload = (
  ruleId: string,
  streamName: string,
  records: Record<string, unknown>[],
) => Promise<void>;

export class AzureLogsIngestionAdapter implements IngestionAdapter {
  private readonly uploadLogs: LogsUpload;

  public constructor(
    endpoint: string,
    private readonly ruleId: string,
    private readonly streamName: string,
    uploadLogs?: LogsUpload,
  ) {
    if (uploadLogs) {
      this.uploadLogs = uploadLogs;
      return;
    }
    const client = new LogsIngestionClient(
      endpoint,
      new DefaultAzureCredential(),
    );
    this.uploadLogs = async (currentRuleId, currentStreamName, records) => {
      await client.upload(currentRuleId, currentStreamName, records);
    };
  }

  public async upload(records: IngestedEvent[]): Promise<void> {
    try {
      await this.uploadLogs(this.ruleId, this.streamName, records);
    } catch (error) {
      const statusCode =
        typeof error === "object" && error !== null && "statusCode" in error
          ? Number(error.statusCode)
          : undefined;
      const retryable =
        statusCode === undefined ||
        statusCode === 408 ||
        statusCode === 429 ||
        statusCode >= 500;
      throw new IngestionError(
        "Azure Monitor rejected or could not receive the event batch",
        retryable,
        {
          cause: error,
        },
      );
    }
  }

  public async readiness(): Promise<{ ready: boolean }> {
    return { ready: true };
  }
}

export class RetryingIngestionAdapter implements IngestionAdapter {
  public constructor(
    private readonly inner: IngestionAdapter,
    private readonly attempts = 3,
    private readonly sleep: (milliseconds: number) => Promise<void> = (
      milliseconds,
    ) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  ) {}

  public async upload(records: IngestedEvent[]): Promise<void> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= this.attempts; attempt += 1) {
      try {
        await this.inner.upload(records);
        return;
      } catch (error) {
        lastError = error;
        if (
          !(error instanceof IngestionError) ||
          !error.retryable ||
          attempt === this.attempts
        ) {
          throw error;
        }
        await this.sleep(50 * 2 ** (attempt - 1));
      }
    }
    throw new IngestionError("Ingestion retry attempts were exhausted", true, {
      cause: lastError,
    });
  }

  public readiness(): Promise<{ ready: boolean; reason?: string }> {
    return this.inner.readiness();
  }
}
