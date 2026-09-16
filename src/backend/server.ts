import { buildBackend } from "./app.js";
import { loadConfig } from "../shared/config.js";
import { createTelemetry } from "../shared/telemetry.js";

const config = loadConfig();
const telemetry = createTelemetry(
  config.POC_MODE === "azure" ? "governed-backend" : "governed-backend-local",
  config.OTEL_EXPORTER_OTLP_ENDPOINT,
  "0.1.0",
  config.OTEL_EXPORTER_OTLP_HEADERS,
);
const app = await buildBackend(config, { tracer: telemetry.tracer });

const shutdown = async () => {
  await app.close();
  await telemetry.shutdown();
};
process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());

await app.listen({ host: config.BACKEND_HOST, port: config.BACKEND_PORT });
console.log(
  JSON.stringify({
    service: "backend",
    mode: config.POC_MODE,
    status: "listening",
  }),
);
