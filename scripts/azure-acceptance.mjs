import { spawnSync } from "node:child_process";

const required = [
  "AZURE_LOG_ANALYTICS_WORKSPACE_ID",
  "GATEWAY_URL",
  "LOCAL_AUTH_TOKEN",
  "OTEL_EXPORTER_OTLP_ENDPOINT",
  "OTEL_EXPORTER_OTLP_HEADERS",
];
const missing = required.filter((name) => !process.env[name]);
if (missing.length > 0)
  throw new Error(`Missing acceptance configuration: ${missing.join(", ")}`);

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", ...options });
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed:\n${result.stderr || result.stdout}`,
    );
  }
  return result.stdout.trim();
}

const results = [];
for (const journey of [
  "success",
  "handled-exception",
  "dependency-failure",
  "sensitive-event",
  "unknown-event",
  "throttling",
]) {
  results.push(
    JSON.parse(run("npm", ["run", "--silent", "journey", "--", journey])),
  );
}

const success = results.find(({ journey }) => journey === "success");
if (!success) throw new Error("Success journey did not return evidence");
const deadline =
  Date.now() + Number(process.env.ACCEPTANCE_TIMEOUT_MS ?? 600_000);
const query = `ExternalMobileEvents_CL | where CorrelationId == "${success.correlationId}" | count`;
let visible = false;
while (Date.now() < deadline) {
  const output = run("az", [
    "monitor",
    "log-analytics",
    "query",
    "--workspace",
    process.env.AZURE_LOG_ANALYTICS_WORKSPACE_ID,
    "--analytics-query",
    query,
    "--output",
    "json",
  ]);
  const rows = JSON.parse(output);
  if (Array.isArray(rows) && Number(rows[0]?.Count ?? 0) > 0) {
    visible = true;
    break;
  }
  await new Promise((resolve) => setTimeout(resolve, 15_000));
}
if (!visible) {
  throw new Error(
    `Business event was not queryable before the bounded timeout; correlationId=${success.correlationId}`,
  );
}
console.log(JSON.stringify({ status: "passed", results }, null, 2));
