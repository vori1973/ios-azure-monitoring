import { readFile, readdir } from "node:fs/promises";

const queryFiles = (await readdir("queries")).filter((name) =>
  name.endsWith(".kql"),
);
if (queryFiles.length < 7)
  throw new Error("Expected the complete KQL query set");
for (const file of queryFiles) {
  const query = await readFile(`queries/${file}`, "utf8");
  if (!query.includes("ago(") && !query.includes("ThresholdPerFiveMinutes")) {
    throw new Error(`${file} is missing a bounded time or threshold parameter`);
  }
}

const workbook = JSON.parse(await readFile("monitoring/workbook.json", "utf8"));
const workbookText = JSON.stringify(workbook);
if (
  !workbookText.includes("Operational telemetry") ||
  !workbookText.includes("Governed business events")
) {
  throw new Error("Workbook does not separate the telemetry streams");
}

const bicep = await readFile("infra/main.bicep", "utf8");
const acrPullModule = await readFile("infra/modules/acr-pull.bicep", "utf8");
const privateDnsModule = await readFile(
  "infra/modules/container-apps-dns.bicep",
  "utf8",
);
const deploymentGuide = await readFile("docs/azure-deployment.md", "utf8");
const expectedColumns = [
  "TimeGenerated",
  "EventType",
  "SchemaVersion",
  "EventId",
  "CorrelationId",
  "ClientSessionId",
  "ApplicationVersion",
  "Outcome",
  "DurationMs",
  "IngestionSource",
];
for (const column of expectedColumns) {
  const declarationCount =
    bicep.match(new RegExp(`name: '${column}'`, "g"))?.length ?? 0;
  const tableModule = await readFile(
    "infra/modules/custom-table.bicep",
    "utf8",
  );
  if (declarationCount !== 1 || !tableModule.includes(`name: '${column}'`)) {
    throw new Error(
      `DCR and custom table schemas do not both declare ${column}`,
    );
  }
}
for (const [name, present] of [
  ["internal ingress", bicep.includes("external: false")],
  [
    "least-privilege role",
    bicep.includes("3913510d-42f4-4e42-8a64-420c390055eb"),
  ],
  [
    "managed identity registry pull",
    acrPullModule.includes("7f951dda-4ed3-4680-a7ca-43fe172d538d") &&
      bicep.includes("registries:"),
  ],
  [
    "POC-scoped private DNS records",
    privateDnsModule.includes("${backendName}.internal") &&
      privateDnsModule.includes("${collectorName}.internal"),
  ],
  ["DCR stream", bicep.includes("Custom-ExternalMobileEvents")],
  [
    "data collection rule",
    bicep.includes("Microsoft.Insights/dataCollectionRules"),
  ],
  ["what-if preview", deploymentGuide.includes("az deployment group what-if")],
]) {
  if (!present) throw new Error(`Azure assets are missing ${name}`);
}

const rollback = await readFile("docs/rollback.md", "utf8");
for (const protectedResource of [
  "existing APIM service",
  "Log Analytics workspace",
  "reused Container Apps environment",
  "registry",
]) {
  if (!rollback.includes(protectedResource)) {
    throw new Error(`Rollback does not protect the ${protectedResource}`);
  }
}
console.log("Verification and rollback assets validated");
