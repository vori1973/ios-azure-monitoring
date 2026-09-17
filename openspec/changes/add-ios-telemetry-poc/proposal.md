## Why

The repository needs a runnable proof of concept that validates the recommended Azure Monitor architecture for an iOS-like external client before a production Swift integration is selected. The POC will demonstrate both operational observability and governed business-event ingestion without placing Azure ingestion credentials in the client.

## What Changes

- Add a portable external-client simulator that mimics an iOS application's lifecycle, outbound requests, failures, and domain events.
- Add an operational telemetry path that emits OpenTelemetry traces, logs, exceptions, dependency failures, and correlation context through a controlled export path to Application Insights and the shared Log Analytics workspace.
- Add an APIM-protected backend path that validates, minimizes, redacts, enriches, and forwards approved business events through the Azure Monitor Logs Ingestion API into a custom Log Analytics table.
- Add local/development substitutes and configuration so the complete flow can be exercised without committing Azure credentials or environment-specific values.
- Add repeatable demonstrations and verification guidance for KQL visibility, correlation, rejected sensitive payloads, credential isolation, alerting, retention, RBAC, and ingestion-cost review.
- Document the support status and limitations of using a portable simulator rather than claiming validation of the OpenTelemetry Swift SDK or a production iOS exporter.
- Explicit non-goals: building a native Swift/iOS application, using Managed Prometheus, treating telemetry as a transactional system of record, provisioning a production landing zone, or approving production data classification and retention policy.

## Capabilities

### New Capabilities

- `external-mobile-telemetry-poc`: Demonstrates and verifies correlated operational telemetry and governed business/audit event ingestion for an iOS-like external client.

### Modified Capabilities

None.

## Impact

- Introduces a new portable client simulator, telemetry collector/export configuration, governed backend API, Azure infrastructure/configuration artifacts, automated tests, and operator documentation.
- Integrates with APIM, a backend workload identity, Application Insights, a Data Collection Rule and ingestion endpoint, a custom Log Analytics table, and the customer's allowlisted Log Analytics workspace.
- Requires runtime and infrastructure technologies to be selected during implementation based on the repository's documented commands and target Azure environment; the proposal does not assume Microsoft-supported direct Swift ingestion.
- Adds no migration or breaking compatibility requirement because the repository has no existing application or accepted specifications.
- Security impact includes strict credential isolation, authenticated client-to-backend access, event/property allowlists, schema validation, payload-size limits, PII/PHI rejection or redaction, and prevention of secrets in telemetry.
- Operational impact includes batching, retry and failure visibility, correlation across both streams, sampling controls, ingestion-volume safeguards, KQL/workbook/alert validation, retention and RBAC review, and explicit documentation of unsupported or customer-maintained components.
- No related GitHub issue or open pull request exists at proposal time.
