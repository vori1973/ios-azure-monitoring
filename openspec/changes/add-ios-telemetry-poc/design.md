## Context

See `proposal.md` for motivation. The repository currently contains only project and OpenSpec templates, with no application runtime, accepted capabilities, build commands, or Azure infrastructure. The source recommendation requires two distinct telemetry paths, assumes an existing allowlisted Log Analytics workspace and APIM instance, excludes Managed Prometheus, and warns that Microsoft's Azure Monitor OpenTelemetry Distro does not document Swift/iOS support.

The user selected a portable simulator rather than a native Swift application. The design therefore validates the external-client behavior, security boundary, correlation, Azure destinations, and operating procedures while preserving a clear boundary for a later native iOS implementation.

## Goals / Non-Goals

**Goals:**

- Make the complete POC reproducible on developer machines and in an approved Azure environment.
- Keep the client independent of Azure credentials and Azure-specific business-event schemas.
- Demonstrate one correlated request across the simulator, gateway boundary, backend, Application Insights, and the custom Log Analytics table.
- Make success, validation rejection, sensitive-data rejection, dependency failure, throttling, and ingestion failure independently testable.
- Parameterize integration with an existing Log Analytics workspace and APIM instance rather than requiring replacement resources.

**Non-Goals:**

- Prove OpenTelemetry Swift SDK lifecycle, offline buffering, background execution, or App Store packaging behavior.
- Build a production mobile authentication solution or production compliance policy.
- Use Log Analytics as the source of truth for business transactions.
- Add Prometheus, Grafana, or an Azure Monitor workspace for Managed Prometheus.
- Automatically alter unrelated tables, retention settings, RBAC assignments, or policies in a shared customer workspace.

## Decisions

### Use a TypeScript workspace on Node.js 22

The POC will use a small TypeScript workspace containing the client simulator, governed backend, shared event contracts, and test utilities. Node.js 22 provides a portable runtime, supported Azure Monitor and Logs Ingestion libraries, and a single language for deterministic journeys and validation.

Alternatives considered:

- Native Swift would test the actual mobile SDK but conflicts with the selected portable scope and would require Apple tooling.
- .NET would provide strong Azure SDK support but would require a separate client simulation approach and add more project structure for this POC.
- Shell or raw REST scripts would be portable but would not adequately demonstrate instrumentation, trace propagation, typed event contracts, or failure handling.

### Separate the POC into explicit trust-boundary components

The runtime topology will contain:

```text
external client simulator
    |-- OTLP/HTTP --> controlled OpenTelemetry Collector --> Azure Monitor
    |
    +-- HTTPS + trace context --> APIM or local gateway substitute
                                --> governed backend
                                      |-- operational telemetry --> Azure Monitor
                                      +-- managed identity --> Logs Ingestion API
                                                            --> DCR
                                                            --> custom table
```

The client simulator owns mobile-like journeys and client spans. APIM owns edge authentication, request-size limits, throttling, and correlation-header policy in Azure. The backend owns authoritative validation, redaction, enrichment, batching, and ingestion outcomes. The OpenTelemetry Collector is the controlled protocol boundary for client telemetry.

An all-in-one process was rejected because it would hide the credential and policy boundaries the POC is intended to validate.

### Use W3C trace context plus a separate opaque correlation identifier

Requests will propagate `traceparent`/`tracestate` for distributed tracing. A server-validated opaque correlation identifier will also be written to the approved business-event record so KQL can correlate the two streams without copying sensitive request data.

Using only a custom correlation header was rejected because it would not exercise standard distributed tracing. Writing full trace payloads into the custom table was rejected because it would duplicate data and weaken stream separation.

### Export client telemetry through a controlled Collector endpoint

The simulator will emit OTLP over HTTP to a Collector endpoint. Local execution will bind the Collector only to the local/container network. Azure execution will use authenticated or private ingress appropriate to the approved environment and a currently supported Azure Monitor export route. The implementation must record the route's support classification and validate that client spans reach Application Insights before claiming the POC acceptance criteria.

Direct export from the client to Application Insights was rejected because it couples the external package to Azure configuration and does not represent the recommended controlled path. A custom telemetry relay was rejected because implementing OTLP translation would add unnecessary protocol and correctness risk.

### Use a versioned, closed business-event contract

The POC will define one demonstrative event, such as `RecommendationGenerated`, with an explicit schema containing:

- event type and schema version
- event timestamp
- opaque correlation and client-session identifiers
- application version
- outcome and bounded duration
- server-controlled ingestion metadata

The contract will not permit arbitrary property bags. APIM will enforce edge controls, while the backend remains the authoritative validator and rejects unknown fields, invalid versions, oversize values, credential-like fields, and deliberately disallowed PII/PHI test fields. Rejection telemetry will contain reason codes and field names only, never rejected values.

An open-ended JSON property bag was rejected because it makes DCR schema governance, data classification, and sensitive-data controls difficult to verify.

### Authenticate Azure ingestion with backend identity

The client will authenticate only to the governed API. In Azure, the backend will use managed identity or another approved workload identity scoped to the DCR/ingestion resource. Local mode will use an explicitly selected mock ingestion adapter that writes sanitized newline-delimited JSON to a disposable development location.

The mock adapter will never be an automatic fallback: the process will identify the selected mode at startup, and Azure-mode configuration or delivery failures will fail explicitly. Client secrets, workspace keys, and service-principal credentials in the simulator are prohibited.

Embedding a Logs Ingestion credential in the client was rejected as incompatible with the trust model. Silent fallback from Azure to local files was rejected because it would create false-positive demonstrations.

### Provide Bicep modules and local container orchestration

Docker Compose will provide the local gateway substitute, backend, Collector, and local observability/ingestion substitutes. Bicep will define or configure only POC-scoped resources: workspace-based Application Insights, the custom table, DCR and endpoint where required, backend hosting/identity, least-privilege role assignments, and the API/policy integration point for an existing APIM instance. Existing workspace and APIM identifiers will be parameters.

Bicep was selected because the target architecture is Azure-specific and benefits from native resource typing. Creating a new APIM instance and Log Analytics workspace by default was rejected due to cost, provisioning time, and the recommendation to reuse approved resources.

### Treat verification assets as part of the POC

The repository will include deterministic journey commands, automated contract and integration tests, KQL queries, a workbook definition or reproducible workbook steps, an alert test, and an operator checklist for retention, RBAC, network allowlisting, sampling, ingestion volume, and cost. Evidence collection will use correlation identifiers and timestamps rather than raw sensitive payloads.

Manual ad hoc validation alone was rejected because it would not make the recommendation repeatable or reviewable.

## Risks / Trade-offs

- [The portable simulator does not prove native iOS lifecycle or exporter behavior] -> State this limitation prominently and retain native Swift validation as a separate future change.
- [Collector-to-Azure support or configuration can change] -> Verify current Microsoft guidance during implementation, pin tested component versions, and document support classification and the exact tested route.
- [A shared APIM or Log Analytics workspace can be affected by POC changes] -> Parameterize existing resources, use POC-specific names and tables, preview infrastructure changes, and avoid changing shared retention or policy defaults automatically.
- [Local substitutes can diverge from Azure behavior] -> Keep one event contract and one suite of journey assertions, then require an Azure acceptance run for completion.
- [Logs Ingestion acceptance does not guarantee immediate query visibility] -> Separate API acceptance from polling-based verification with bounded timeout and diagnostic output.
- [Retries can create duplicate business records] -> Include a stable event identifier and document at-least-once delivery semantics and deduplication expectations in tests and KQL.
- [Telemetry can accidentally capture sensitive data] -> Use closed schemas, attribute allowlists, sanitizer tests, payload-value suppression, and deliberately rejected fixtures.
- [APIM availability or permissions can block deployment] -> Keep a local gateway substitute and make the existing APIM integration a separately verifiable deployment step without bypassing it for Azure acceptance.

## Migration Plan

1. Establish repository commands and deploy the local topology without Azure credentials.
2. Deploy POC-namespaced monitoring, ingestion, identity, and backend resources against approved existing workspace and APIM parameters.
3. Apply the POC API and policy configuration to the existing APIM instance after reviewing the deployment preview.
4. Run deterministic Azure journeys and capture KQL, alert, RBAC, retention, network, and cost evidence.
5. Roll back by removing the POC APIM API/policy and POC-scoped backend, DCR, endpoint, table, Application Insights, and role assignments. Do not delete or reset the shared APIM instance or Log Analytics workspace; export required evidence before removing the custom table.

## Open Questions

- Which approved subscription, region, existing APIM instance, and Log Analytics workspace will host the Azure acceptance run?
- What event name and data-classification decision should replace the illustrative `RecommendationGenerated` contract for a customer demonstration?
- Which network path and private-connectivity controls are required by the target customer's allowlisting policy?
