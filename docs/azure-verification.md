# Azure verification

Run `node scripts/azure-acceptance.mjs` after deployment with the approved
workspace ID, gateway URL, client token, APIM OTLP endpoint, and OTLP header.
The runner executes every deterministic journey and polls Log Analytics for no
longer than `ACCEPTANCE_TIMEOUT_MS` (ten minutes by default).

```bash
export AZURE_LOG_ANALYTICS_WORKSPACE_ID="<workspace-customer-id>"
export GATEWAY_URL="https://<apim-host>/external-mobile-telemetry"
export LOCAL_AUTH_TOKEN="<external-client-access-token>"
export OTEL_EXPORTER_OTLP_ENDPOINT="$GATEWAY_URL"
export OTEL_EXPORTER_OTLP_HEADERS="x-otlp-token=<poc-otlp-token>"
node scripts/azure-acceptance.mjs
```

Use the parameterized queries under `queries/` to collect evidence:

| Evidence                                      | Query                           |
| --------------------------------------------- | ------------------------------- |
| Correlated mobile, gateway, and backend trace | `end-to-end-trace.kql`          |
| Handled client exception                      | `handled-exception.kql`         |
| Failed backend dependency                     | `failed-dependency.kql`         |
| Sanitized validation rejection                | `sanitized-rejections.kql`      |
| Ingestion failure diagnostics                 | `ingestion-diagnostics.kql`     |
| Custom business record                        | `business-event.kql`            |
| Abnormal custom ingestion volume              | `abnormal-ingestion-volume.kql` |

Import `monitoring/workbook.json` into a POC-scoped Azure Workbook and select
only the POC Application Insights resource and approved workspace. Do not edit
shared workbooks.

## Alert demonstration

Create POC-scoped scheduled query alerts from `failed-dependency.kql` and
`abnormal-ingestion-volume.kql`. Trigger the dependency alert with:

```bash
npm run journey -- dependency-failure
```

Trigger ingestion volume only with an approved low threshold and bounded event
count. After evidence is captured, disable or delete only the POC alert rules
and confirm their state is resolved. Never alter shared alert rules.

## Operator checklist

Record each item as `confirmed`, `failed`, or `not-verified`:

| Control                                                                        | Status       | Evidence |
| ------------------------------------------------------------------------------ | ------------ | -------- |
| Backend identity has Monitoring Metrics Publisher only at DCR scope            | not-verified |          |
| Custom table access is limited to approved roles                               | not-verified |          |
| Table and Application Insights retention match approval                        | not-verified |          |
| APIM can reach internal Container Apps and direct public ingress is absent     | not-verified |          |
| Sensitive-event fixture is rejected and its value is absent from all telemetry | not-verified |          |
| Simulator package contains no Azure service credential                         | not-verified |          |
| Sampling retains required exceptions, failures, and business events            | not-verified |          |
| Daily cap and ingestion-volume alerts were reviewed                            | not-verified |          |
| Estimated ingestion cost was recorded for expected POC volume                  | not-verified |          |
| Workbook and alerts reference only POC resources                               | not-verified |          |

## Support status checked 2026-09-15

| Component                                                                        | Classification                             | Use and source                                                                                                                                                                               |
| -------------------------------------------------------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Standard OpenTelemetry JavaScript SDK used by the portable simulator and backend | CNCF/community-supported                   | Used through the controlled Collector. https://opentelemetry.io/docs/languages/js/                                                                                                           |
| Microsoft Azure Monitor OpenTelemetry distribution for Node.js                   | Microsoft-supported GA                     | Authoritative Node.js SDK reference; not installed by this Collector-path POC. https://learn.microsoft.com/javascript/api/overview/azure/monitor-opentelemetry-readme?view=azure-node-latest |
| Azure Monitor Ingestion client library for JavaScript                            | Microsoft-supported GA                     | Used by the governed backend as `@azure/monitor-ingestion`. https://learn.microsoft.com/javascript/api/overview/azure/monitor-ingestion-readme?view=azure-node-latest                        |
| Azure Identity client library for JavaScript                                     | Microsoft-supported GA                     | Used by the backend for `DefaultAzureCredential`. https://learn.microsoft.com/javascript/api/@azure/identity/defaultazurecredential?view=azure-node-latest                                   |
| OpenTelemetry Collector Azure Monitor exporter                                   | OpenTelemetry contrib/community-maintained | Used for the operational telemetry destination. https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/exporter/azuremonitorexporter                                    |
| Azure Monitor Logs Ingestion API and DCR pipeline                                | Microsoft-supported GA                     | https://learn.microsoft.com/azure/azure-monitor/logs/logs-ingestion-api-overview                                                                                                             |
| Azure Container Apps internal ingress                                            | Microsoft-supported GA                     | https://learn.microsoft.com/azure/container-apps/ingress-overview                                                                                                                            |
| Native Swift/iOS export path                                                     | **Not validated by this POC**              | https://github.com/open-telemetry/opentelemetry-swift                                                                                                                                        |

See [`sdk-references.md`](sdk-references.md) for the implementation mapping.
Support classifications must be rechecked at the time of each demonstration.
