## 1. Project Foundation

- [x] 1.1 Replace the template project context in `AGENTS.md`, `README.md`, and `openspec/config.yaml` with the POC purpose, architecture, Node.js 22 prerequisites, commands, compatibility constraints, deployment assumptions, and ownership boundaries; verify no required template placeholders remain.
- [x] 1.2 Create the TypeScript workspace for the simulator, backend, shared contracts, and test utilities; verify dependency installation, type-check, build, lint, and test commands all run from the repository root.
- [x] 1.3 Add typed configuration for explicit `local` and `azure` modes plus a safe `.env.example`; verify startup rejects missing Azure-mode settings and never silently switches to local ingestion.
- [x] 1.4 Add repository-standard formatting, linting, test coverage, and secret-scanning configuration; verify a clean baseline passes and a committed test credential fixture is detected.

## 2. Shared Contracts and Data Controls

- [x] 2.1 Define the versioned closed schema for the illustrative `RecommendationGenerated` event, including bounded identifiers, timestamp, application version, outcome, duration, and event identifier; verify valid and invalid contract fixtures with unit tests.
- [x] 2.2 Implement shared trace and opaque-correlation context helpers; verify generated identifiers are valid, caller-supplied invalid identifiers are rejected, and W3C headers survive serialization.
- [x] 2.3 Implement telemetry attribute allowlists and sanitization that suppress payload values, credentials, tokens, secrets, and disallowed PII/PHI fields; verify deliberately sensitive fixtures never appear in captured logs, spans, or rejection output.
- [x] 2.4 Define explicit API error and ingestion outcome contracts for authentication, validation, throttling, configuration, retry exhaustion, and Azure rejection; verify each outcome has a distinct status and machine-readable reason code.

## 3. Governed Backend

- [x] 3.1 Implement the authenticated business-event endpoint with a replaceable local authentication verifier and an Azure/APIM trust contract; verify missing, invalid, and valid identities produce the expected outcomes.
- [x] 3.2 Implement authoritative event validation, unknown-field rejection, size limits, schema-version checks, server enrichment, and correlation validation; verify rejected events never reach the ingestion adapter.
- [x] 3.3 Implement the explicit local ingestion adapter that writes sanitized newline-delimited records to a disposable path; verify local records contain only the approved custom-table columns.
- [x] 3.4 Implement the Azure Logs Ingestion adapter using workload identity and configured DCR endpoint, immutable ID, and stream name; verify adapter tests use a mock transport and contain no client secret or workspace key.
- [x] 3.5 Implement bounded retry, backoff, stable event identifiers, and explicit failure propagation for retryable ingestion errors; verify tests cover eventual success, retry exhaustion, non-retryable rejection, and duplicate-risk telemetry.
- [x] 3.6 Instrument backend requests, validation rejections, ingestion calls, and sanitized logs with OpenTelemetry; verify spans preserve incoming trace context and do not record full business-event payloads.
- [x] 3.7 Add a deterministic backend dependency operation that can succeed, fail, or time out for demonstration purposes; verify dependency telemetry records outcome and duration for each mode.
- [x] 3.8 Add backend health and readiness endpoints that distinguish process health from Azure configuration and dependency readiness; verify unhealthy configuration cannot produce a success-shaped readiness response.

## 4. External Mobile Client Simulator

- [x] 4.1 Implement deterministic `success`, `handled-exception`, `dependency-failure`, `sensitive-event`, `unknown-event`, and `throttling` journeys; verify each journey exits with the documented outcome and prints its correlation identifiers.
- [x] 4.2 Instrument mobile-like startup, screen/action, outbound request, handled exception, and dependency spans with OpenTelemetry; verify local captured spans contain expected names, statuses, and shared trace context.
- [x] 4.3 Export simulator telemetry over OTLP/HTTP only to the configured controlled endpoint; verify an unavailable endpoint reports export loss explicitly without exposing configuration secrets.
- [x] 4.4 Ensure the simulator calls only the governed business API for custom events and propagates W3C trace headers plus the opaque correlation identifier; verify HTTP-capture tests contain no Azure Monitor Logs Ingestion URL.
- [x] 4.5 Produce a distributable simulator package and automated credential inspection; verify the package contains no Azure credential, service-principal secret, workspace key, DCR authorization token, or backend-only configuration.

## 5. Local POC Topology

- [x] 5.1 Add a development OpenTelemetry Collector configuration with OTLP/HTTP reception, bounded batching, attribute filtering, and observable local export; verify the configuration passes the Collector validation command.
- [x] 5.2 Add a local gateway substitute that enforces authentication, request-size, throttling, and trace-header forwarding behaviors equivalent to the POC APIM contract; verify policy-focused integration tests cover each control.
- [x] 5.3 Add Dockerfiles and Docker Compose services for the gateway substitute, backend, Collector, and local observability/ingestion substitutes with health checks and isolated networking; verify the stack becomes healthy without Azure credentials.
- [x] 5.4 Add a local end-to-end test that runs all simulator journeys and inspects spans, sanitized rejection telemetry, dependency failures, throttling, and newline-delimited business records; verify the test proves correlation and absence of prohibited values.
- [x] 5.5 Add deterministic cleanup for local containers and disposable telemetry files; verify cleanup removes only POC-created resources and leaves unrelated developer files untouched.

## 6. Azure Infrastructure and Policy

- [x] 6.1 Create parameterized Bicep modules that reference an approved existing Log Analytics workspace and create POC-namespaced workspace-based Application Insights resources; verify Bicep compilation and resource-scope tests pass.
- [x] 6.2 Create the custom Log Analytics table, Data Collection Rule, stream declaration, transform, and Data Collection Endpoint only where required; verify the DCR output schema exactly matches the closed event contract.
- [x] 6.3 Create the backend hosting resource, managed identity, configuration references, and least-privilege ingestion role assignment at the narrowest supported scope; verify no backend secret is emitted in deployment outputs.
- [x] 6.4 Define the controlled Collector hosting and ingress configuration for the approved network path; verify unauthenticated public OTLP ingestion is not enabled by the Azure configuration.
- [x] 6.5 Define the POC API and APIM policies for identity validation, payload-size limits, throttling, correlation propagation, backend routing, and sanitized diagnostics against an existing APIM instance; verify policy syntax and parameter substitution tests pass.
- [x] 6.6 Add deployment parameter examples that contain only placeholders and document required existing resource identifiers, permissions, regions, and allowlisting inputs; verify secret scanning passes on every example.
- [x] 6.7 Add a non-destructive deployment preview command and review gates for shared APIM and workspace changes; verify the documented workflow produces an Azure what-if result before deployment.

## 7. Azure Verification Assets

- [x] 7.1 Add KQL queries for the end-to-end trace, handled exception, failed dependency, sanitized rejection, ingestion diagnostics, and custom business event; verify each query is parameterized by time range and correlation identifier.
- [x] 7.2 Add a workbook definition or reproducible workbook setup that separates operational and business-event views; verify the documented import/setup procedure references only POC resources.
- [ ] 7.3 Add an alert demonstration for a selected operational failure and abnormal ingestion volume; verify the test procedure can trigger and then clear the alert without changing shared alert rules.
- [x] 7.4 Add an Azure acceptance runner that executes the required journeys and polls with a bounded timeout for Application Insights and custom-table visibility; verify missing telemetry fails with actionable diagnostics instead of indefinite waiting.
- [x] 7.5 Add an operator checklist for RBAC, retention, table access, network allowlisting/private connectivity, sampling, daily-cap implications, ingestion volume, and estimated cost; verify every item records confirmed, failed, or not-verified status.
- [x] 7.6 Add a support-status matrix with dated authoritative sources for the simulator SDK, Collector exporter/ingestion route, backend Azure Monitor SDK, and Logs Ingestion API; verify the documentation explicitly states that native Swift/iOS export is not validated.

## 8. Acceptance, Documentation, and Rollback

- [x] 8.1 Document setup, build, lint, test, local run, Azure preview/deploy, journey execution, evidence collection, and troubleshooting commands; verify a fresh-clone local walkthrough succeeds using only documented steps.
- [ ] 8.2 Run the targeted unit, contract, integration, local end-to-end, Bicep, policy, and secret-scan checks and record the exact commands and results in the implementation pull request.
- [ ] 8.3 Run the approved Azure acceptance procedure and capture evidence for trace correlation, handled exception, failed dependency, approved event ingestion, sensitive-event rejection, credential isolation, KQL, workbook, alert, RBAC, retention, network, and cost checks; record any item that cannot be verified.
- [ ] 8.4 Document and test rollback that removes only the POC APIM API/policy and POC-scoped application, identity, DCR, endpoint, table, Application Insights, and role assignments while preserving the shared APIM instance and Log Analytics workspace.
- [x] 8.5 Reconcile the implementation with `proposal.md`, the capability spec, and `design.md`, update completed checkboxes, and verify `openspec validate add-ios-telemetry-poc --strict` succeeds before requesting review.
