import { createTelemetry } from "../shared/telemetry.js";
import { loadSimulatorConfig } from "./config.js";
import { runJourney, type JourneyName } from "./journeys.js";

const allowedJourneys = new Set<JourneyName>([
  "success",
  "handled-exception",
  "dependency-failure",
  "sensitive-event",
  "unknown-event",
  "throttling",
]);
const requested = process.argv[2] as JourneyName | undefined;
if (!requested || !allowedJourneys.has(requested)) {
  throw new Error(`Journey must be one of: ${[...allowedJourneys].join(", ")}`);
}

const config = loadSimulatorConfig();
const telemetry = createTelemetry(
  config.OTEL_SERVICE_NAME,
  config.OTEL_EXPORTER_OTLP_ENDPOINT,
  "0.1.0",
  config.OTEL_EXPORTER_OTLP_HEADERS,
);
const result = await runJourney(requested, {
  gatewayUrl: config.GATEWAY_URL,
  token: config.LOCAL_AUTH_TOKEN,
  tracer: telemetry.tracer,
});
await telemetry.shutdown();

console.log(JSON.stringify(result));
if (!result.expected) process.exitCode = 1;
if (telemetry.exportErrorCount() > 0) {
  console.error(
    JSON.stringify({
      error: "telemetry_export_failed",
      droppedOrFailedExports: telemetry.exportErrorCount(),
    }),
  );
  process.exitCode = 1;
}
