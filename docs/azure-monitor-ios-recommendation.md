# Recommendation Summary: Monitoring an iOS Application with Azure Monitor

## Executive recommendation

Use **two complementary telemetry paths** for the mobile solution:

1. **Operational observability** for application health, performance, failures, traces, and dependencies.
2. **Business and audit events** for domain-specific records that should land in dedicated Log Analytics tables.

Both paths can use the customer's existing, allowlisted **Log Analytics workspace**. The proposed baseline does **not** require an **Azure Monitor workspace for Managed Prometheus**. Prometheus storage would be relevant only if the customer separately chooses a Prometheus/Grafana metrics design.

> **Important iOS qualification:** Microsoft’s Azure Monitor OpenTelemetry Distro documentation currently lists .NET, Java, Node.js, and Python, not Swift/iOS. For iOS, evaluate the open-source OpenTelemetry Swift SDK and a supported export path, preferably through a controlled collector or backend. Validate the selected iOS-to-Azure export path in a proof of concept before describing it as a fully Microsoft-supported direct SDK integration.

---

## POC implementation mapping

| Recommendation                                     | POC implementation                                                                                             |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Separate operational and business telemetry        | Implemented as two explicit paths with separate schemas and destinations                                       |
| Controlled operational export                      | Standard OpenTelemetry JavaScript SDK sends OTLP/HTTP through APIM or the controlled Collector                 |
| Governed business-event ingestion                  | APIM routes authenticated versioned JSON to the backend, which uses Microsoft `@azure/monitor-ingestion`       |
| No Azure ingestion credential in the mobile client | Enforced by configuration boundaries, packaging checks, and secret scanning                                    |
| Shared Log Analytics platform                      | Workspace-based Application Insights and `ExternalMobileEvents_CL` use the approved existing workspace         |
| No Managed Prometheus requirement                  | Preserved as an explicit non-goal                                                                              |
| Validate native Swift/iOS behavior separately      | Not claimed by this POC; the portable TypeScript simulator validates the external HTTP and telemetry contracts |

The concrete topology, SDK placement, trust boundaries, and local-to-Azure
mapping are documented in [architecture.md](architecture.md).

---

## 1. Operational telemetry

### Purpose

Answer: **Is the application healthy, reliable, and performing as expected?**

Typical signals include:

- Crashes and exceptions
- App startup and screen-load duration
- Outbound API calls and latency
- Failed or timed-out dependencies
- Distributed trace and correlation identifiers
- Technical events and diagnostic logs
- Carefully selected custom metrics

### Recommended logical flow

```text
iOS application
    |
    | OpenTelemetry instrumentation
    v
Controlled telemetry export path
    |  Option: backend or OpenTelemetry Collector
    v
Application Insights / Azure Monitor
    v
Log Analytics workspace
    v
Application Insights experiences, KQL, workbooks and alerts
```

### SDK and protocol references

- [OpenTelemetry Swift repository and SDK guidance](https://github.com/open-telemetry/opentelemetry-swift)
- [OpenTelemetry protocol specification](https://opentelemetry.io/docs/specs/otlp/)
- [Enable OpenTelemetry in Application Insights](https://learn.microsoft.com/en-us/azure/azure-monitor/app/opentelemetry-enable)
- [Configure Azure Monitor OpenTelemetry](https://learn.microsoft.com/en-us/azure/azure-monitor/app/opentelemetry-configuration)
- [OpenTelemetry with Azure Monitor](https://learn.microsoft.com/en-us/azure/azure-monitor/containers/opentelemetry-options)
- [Ingest OTLP data through an OpenTelemetry Collector](https://learn.microsoft.com/en-us/azure/azure-monitor/containers/opentelemetry-protocol-ingestion)
- [Create and configure a workspace-based Application Insights resource](https://learn.microsoft.com/en-us/azure/azure-monitor/app/create-workspace-resource)

### Implementation note for iOS

Do not assume that an iOS application can simply install the Microsoft Azure Monitor OpenTelemetry Distro. The documented Microsoft distro languages do not currently include Swift. A reasonable design candidate is:

```text
iOS OpenTelemetry Swift SDK
    -> authenticated enterprise backend or controlled OTel Collector
    -> Azure Monitor ingestion
```

The exact export and authentication pattern must be validated against current Microsoft support status, customer networking controls, mobile lifecycle behavior, batching, offline operation, and security requirements.

---

## 2. Business and audit telemetry

### Purpose

Answer: **What domain action occurred, under what business context, and what evidence must be retained?**

Examples include:

- Consent recorded or withdrawn
- Product viewed
- Recommendation generated
- Workflow submitted
- Order completed
- Auditable decision event
- Domain-specific processing status

Business events should not be treated as a substitute for transactional systems of record. Only telemetry appropriate for monitoring and audit analysis should be sent to Log Analytics.

### Recommended logical flow

```text
iOS application
    v
APIM-protected business API
    v
Backend service
    |  validate, minimize, redact and enrich
    v
Azure Monitor Logs Ingestion API
    v
Data Collection Rule
    v
Custom Log Analytics table
```

### SDK and REST references

- [Logs Ingestion API overview](https://learn.microsoft.com/en-us/azure/azure-monitor/logs/logs-ingestion-api-overview)
- [Logs Ingestion API tutorial](https://learn.microsoft.com/en-us/azure/azure-monitor/logs/tutorial-logs-ingestion-portal)
- [Azure Monitor Ingestion client library for .NET](https://learn.microsoft.com/en-us/dotnet/api/overview/azure/monitor.ingestion-readme)
- [Azure Monitor Ingestion client library for Java](https://learn.microsoft.com/en-us/java/api/overview/azure/monitor-ingestion-readme)
- [Azure Monitor Ingestion client library for JavaScript](https://learn.microsoft.com/en-us/javascript/api/overview/azure/monitor-ingestion-readme)
- [Azure Monitor Ingestion client library for Python](https://learn.microsoft.com/en-us/python/api/overview/azure/monitor-ingestion-readme)

### REST request pattern

```http
POST https://{endpoint}/dataCollectionRules/{dcr-immutable-id}/streams/{stream-name}?api-version=2023-01-01
Authorization: Bearer {access-token}
Content-Type: application/json
```

Illustrative payload:

```json
[
  {
    "TimeGenerated": "2026-09-15T16:00:00Z",
    "EventType": "ConsentRecorded",
    "CorrelationId": "opaque-correlation-id",
    "ApplicationVersion": "1.0.0",
    "Outcome": "Succeeded"
  }
]
```

The incoming JSON must match the stream declaration expected by the Data Collection Rule, or be transformed by the DCR into the target table schema.

---

## 3. Why the mobile app should not call Logs Ingestion API directly

For the business/audit path, place APIM and a backend service between the iOS app and Azure Monitor. This is an architectural recommendation, rather than a Logs Ingestion API requirement.

Benefits include:

- No Azure service-principal secret embedded in the mobile app
- Central authentication and authorization
- Payload validation and schema versioning
- PII/PHI minimization and redaction
- Throttling, retry, and batching control
- Consistent correlation identifiers
- Reduced coupling between the app and the DCR/table schema
- Central policy enforcement and auditability

The backend should authenticate to Azure using a workload identity or managed identity where supported, rather than a secret distributed to mobile clients.

---

## 4. Workspace and allowlisting impact

| Resource                                           | Role in this proposal                                           |                         Required? |
| -------------------------------------------------- | --------------------------------------------------------------- | --------------------------------: |
| Log Analytics workspace                            | Stores Application Insights logs/traces and custom-table events |                               Yes |
| Workspace-based Application Insights               | APM and investigation experience                                |     Yes, for the operational path |
| Data Collection Rule                               | Defines and routes Logs Ingestion API data                      |            Yes, for custom events |
| Data Collection Endpoint or DCR ingestion endpoint | Receives custom log data                                        | Depends on the DCR/network design |
| Azure Monitor workspace for Managed Prometheus     | Prometheus metric storage and PromQL/Grafana scenarios          |         No, not for this baseline |
| APIM and backend service                           | Govern the business-event API and protect Azure ingestion       |                       Recommended |

Because the customer already uses an allowlisted Log Analytics workspace with AKS and APIM, the proposed design aligns with an established workspace type. Existing use does not automatically approve every new table, endpoint, data classification, retention policy, or network path, so those items should remain part of the architecture and security review.

---

## 5. Security and governance guardrails

- Do not send credentials, tokens, secrets, raw access tokens, or unnecessary personal data as telemetry.
- Define an explicit allowlist of event names and properties.
- Use opaque or pseudonymous identifiers where identity is not operationally required.
- Classify business events before ingestion and document whether they contain PII, PHI, or regulated data.
- Apply retention, access control, private connectivity, and export requirements at the Log Analytics workspace and ingestion layers.
- Keep operational telemetry and business/audit telemetry logically separated through table design, schemas, access, and retention.
- Use correlation IDs to connect the two streams without duplicating sensitive payloads.
- Apply sampling to high-volume operational telemetry only after confirming which signals must never be sampled.
- Establish cost controls such as daily caps, retention review, transformation/filtering, and alerting on abnormal ingestion volume.

---

## 6. Suggested customer wording

> We recommend two complementary telemetry paths for the iOS application. Operational telemetry, including application failures, performance, traces, and dependencies, should use OpenTelemetry instrumentation and the Application Insights/Azure Monitor observability experience. Domain-specific business and audit events should flow through an authenticated APIM-protected backend and then use the Azure Monitor Logs Ingestion API to write to governed custom Log Analytics tables. Both paths can use the customer's approved Log Analytics workspace and do not require Azure Monitor workspace for Managed Prometheus as part of this baseline. Because Microsoft’s documented Azure Monitor OpenTelemetry Distro languages do not currently include Swift, the iOS OpenTelemetry SDK and export path should be validated in a focused proof of concept before production adoption.

---

## 7. Proof-of-concept acceptance criteria

1. Capture one iOS trace spanning the mobile call, APIM, and backend using a propagated correlation context.
2. Record one handled exception and one failed backend dependency in the operational telemetry path.
3. Submit one sanitized business event through APIM/backend into a custom Log Analytics table.
4. Confirm that no application secret or Azure ingestion credential is present in the mobile package.
5. Verify PII/PHI filtering with approved and deliberately rejected test payloads.
6. Confirm expected KQL queries, workbook visibility, alert behavior, retention, RBAC, and ingestion cost.
7. Document whether the selected iOS exporter and Azure ingestion route are generally available, preview, community-supported, or customer-maintained at the time of implementation.

---

## Decision

Proceed with the **two-stream pattern**, using the existing allowlisted **Log Analytics workspace** as the shared Azure Monitor data platform. Treat **Managed Prometheus/Azure Monitor workspace** as out of scope unless a separate Prometheus metrics requirement emerges. Validate the **iOS OpenTelemetry export path** through a focused proof of concept and retain APIM plus a backend as the governed entry point for custom business and audit events.
