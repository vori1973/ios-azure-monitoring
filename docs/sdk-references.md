# Microsoft SDK references

## Operational telemetry

Microsoft's supported Node.js distribution for sending OpenTelemetry data to
Azure Monitor is
[`@azure/monitor-opentelemetry`](https://learn.microsoft.com/javascript/api/overview/azure/monitor-opentelemetry-readme?view=azure-node-latest).
It supports Node.js workloads and exports to workspace-based Application
Insights using `APPLICATIONINSIGHTS_CONNECTION_STRING`.

This POC references that Microsoft SDK for production Node.js guidance but does
not currently install it. The simulator and backend use the standard
OpenTelemetry JavaScript SDK and send OTLP/HTTP to the controlled Collector so
the POC exercises one explicit operational telemetry boundary. The Microsoft
Node.js distribution is not an iOS or Swift SDK, and this POC does not claim
native iOS exporter validation.

## Governed business-event ingestion

The governed backend uses Microsoft's
[`@azure/monitor-ingestion`](https://learn.microsoft.com/javascript/api/overview/azure/monitor-ingestion-readme?view=azure-node-latest)
client library to send approved records through the Azure Monitor Logs
Ingestion API. It constructs `LogsIngestionClient` with
[`DefaultAzureCredential`](https://learn.microsoft.com/javascript/api/@azure/identity/defaultazurecredential?view=azure-node-latest)
from `@azure/identity`.

Only the backend receives the Azure workload identity. The external simulator
does not contain a DCR credential, workspace key, service-principal secret, or
Logs Ingestion client.

The simulator demonstrates the HTTP contract expected from an external mobile
application: valid API authentication, `traceparent`, opaque correlation,
versioned JSON, and bounded closed-schema payloads. It does not validate native
mobile offline buffering, lifecycle hooks, background execution, retry queues,
or exporter reliability.

## Implementation mapping

| Component                                    | Package or service                                                          | Status in this POC                               |
| -------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------ |
| External simulator instrumentation           | Standard OpenTelemetry JavaScript packages                                  | Used                                             |
| Backend operational instrumentation          | Standard OpenTelemetry JavaScript packages through the controlled Collector | Used                                             |
| Microsoft Node.js Azure Monitor distribution | `@azure/monitor-opentelemetry`                                              | Authoritative Microsoft reference; not installed |
| Backend custom-log delivery                  | `@azure/monitor-ingestion`                                                  | Used                                             |
| Backend workload authentication              | `@azure/identity`                                                           | Used                                             |
| Collector-to-Application Insights export     | OpenTelemetry Collector Azure Monitor exporter                              | Used; community-maintained component             |

References were checked on 2026-09-16.
