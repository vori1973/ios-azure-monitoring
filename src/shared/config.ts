import { z } from "zod";

const baseSchema = z.object({
  POC_MODE: z.enum(["local", "azure"]),
  BACKEND_HOST: z.string().default("0.0.0.0"),
  BACKEND_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  GATEWAY_HOST: z.string().default("0.0.0.0"),
  GATEWAY_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  BACKEND_URL: z.string().url().default("http://localhost:3001"),
  GATEWAY_URL: z.string().url().default("http://localhost:3000"),
  LOCAL_AUTH_TOKEN: z.string().min(12),
  LOCAL_INGESTION_PATH: z
    .string()
    .min(1)
    .default(".local-data/business-events.ndjson"),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url(),
  OTEL_EXPORTER_OTLP_HEADERS: z.string().default(""),
  OTEL_SERVICE_NAME: z.string().min(1).default("external-mobile-telemetry-poc"),
  APIM_TRUST_HEADER_NAME: z.string().min(1).default("x-apim-authenticated"),
  APIM_TRUST_HEADER_VALUE: z.string().min(12).optional(),
  AZURE_LOGS_ENDPOINT: z.string().url().optional(),
  AZURE_DCR_IMMUTABLE_ID: z.string().startsWith("dcr-").optional(),
  AZURE_DCR_STREAM_NAME: z.string().startsWith("Custom-").optional(),
});

export type AppConfig = z.infer<typeof baseSchema>;

export function loadConfig(
  environment: NodeJS.ProcessEnv = process.env,
): AppConfig {
  const parsed = baseSchema.parse(environment);

  if (parsed.POC_MODE === "azure") {
    const missing = [
      "APIM_TRUST_HEADER_VALUE",
      "AZURE_LOGS_ENDPOINT",
      "AZURE_DCR_IMMUTABLE_ID",
      "AZURE_DCR_STREAM_NAME",
    ].filter((key) => !parsed[key as keyof AppConfig]);

    if (missing.length > 0) {
      throw new Error(
        `Azure mode is missing required configuration: ${missing.join(", ")}`,
      );
    }
  }

  return parsed;
}
