import { z } from "zod";

const simulatorConfigSchema = z.object({
  POC_MODE: z.enum(["local", "azure"]),
  GATEWAY_URL: z.string().url().default("http://localhost:3000"),
  LOCAL_AUTH_TOKEN: z.string().min(12),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url(),
  OTEL_EXPORTER_OTLP_HEADERS: z.string().default(""),
  OTEL_SERVICE_NAME: z.string().min(1).default("external-mobile-simulator"),
});

export type SimulatorConfig = z.infer<typeof simulatorConfigSchema>;

export function loadSimulatorConfig(
  environment: NodeJS.ProcessEnv = process.env,
): SimulatorConfig {
  return simulatorConfigSchema.parse(environment);
}
