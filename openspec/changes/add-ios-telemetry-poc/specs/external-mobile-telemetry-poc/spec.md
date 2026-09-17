## Purpose

Defines a portable proof of concept that validates correlated operational telemetry and governed business-event ingestion for an external mobile client using Azure Monitor.

## ADDED Requirements

### Requirement: Portable external mobile client simulation
The system SHALL provide a portable client simulator that can run deterministic success and failure journeys representative of an external iOS application without requiring Xcode or a physical Apple device.

#### Scenario: Run a successful client journey
- **WHEN** an operator starts the documented successful journey with valid configuration
- **THEN** the simulator completes an outbound backend request and submits an approved business event

#### Scenario: Run the POC locally
- **WHEN** an operator selects the documented local mode without Azure credentials
- **THEN** the simulator, controlled telemetry path, gateway substitute, backend, and local ingestion substitute run with observable structured output

### Requirement: End-to-end operational trace correlation
The system SHALL propagate standards-based trace context from the external client through the API gateway boundary to the backend and SHALL export the participating spans through a controlled telemetry path to Application Insights.

#### Scenario: Correlate a successful request
- **WHEN** the simulator invokes the backend through the configured gateway
- **THEN** Application Insights contains client and backend telemetry that can be joined by one trace identifier

#### Scenario: Preserve business-event correlation
- **WHEN** the successful request also produces an approved business event
- **THEN** the operational trace and custom-table record contain the same opaque correlation identifier

### Requirement: Operational failure telemetry
The system SHALL provide deterministic demonstrations of a handled client exception and a failed or timed-out backend dependency without including sensitive payload content in telemetry.

#### Scenario: Capture a handled client exception
- **WHEN** the operator runs the handled-exception journey
- **THEN** the operational telemetry path records the exception as handled with the journey correlation context

#### Scenario: Capture a failed dependency
- **WHEN** the operator runs the dependency-failure journey
- **THEN** the backend dependency telemetry records the failed or timed-out call, duration, result, and correlation context

### Requirement: Controlled operational telemetry export
The external client SHALL export operational telemetry only to the configured controlled collector or backend endpoint and SHALL NOT require an Azure service credential in the client configuration or distributable package.

#### Scenario: Inspect client configuration and package
- **WHEN** an operator builds or packages the simulator using the documented process
- **THEN** no Azure ingestion credential, service-principal secret, workspace key, or connection secret is present in the client artifact

#### Scenario: Controlled endpoint is unavailable
- **WHEN** the configured operational telemetry endpoint cannot be reached
- **THEN** the simulator reports the export failure or dropped-telemetry condition explicitly without exposing credentials or silently reporting successful delivery

### Requirement: Governed business-event ingestion
The system SHALL accept versioned business events through an authenticated gateway and backend, enrich approved events with server-controlled metadata, and submit them through the Azure Monitor Logs Ingestion API to a dedicated custom Log Analytics table.

#### Scenario: Ingest an approved event
- **WHEN** an authenticated client submits an allowlisted event with a valid schema
- **THEN** the backend accepts the event and a matching record becomes queryable in the configured custom table

#### Scenario: Prevent direct client ingestion
- **WHEN** the client submits a business event
- **THEN** the client calls only the governed business API and does not call the Azure Monitor Logs Ingestion endpoint directly

### Requirement: Business-event data governance
The business-event API SHALL enforce an allowlist of event names and properties, schema version, field types, length and payload-size limits, and rules that reject credentials, tokens, secrets, and disallowed personal or health information.

#### Scenario: Reject an unknown event
- **WHEN** an authenticated client submits an event name or schema version that is not allowlisted
- **THEN** the API rejects the request with a validation response and does not send it to Azure Monitor

#### Scenario: Reject a sensitive payload
- **WHEN** an authenticated client submits a payload containing a deliberately disallowed credential or sensitive-data field
- **THEN** the API rejects the request, records a sanitized rejection reason in operational telemetry, and does not persist the prohibited value

#### Scenario: Minimize accepted data
- **WHEN** an approved event is sent to the Logs Ingestion API
- **THEN** the outgoing record contains only documented business fields, opaque identifiers, and server-controlled metadata

### Requirement: Explicit ingestion outcomes
The backend SHALL distinguish accepted ingestion from validation, authentication, throttling, configuration, and Azure ingestion failures and SHALL expose failure outcomes without success-shaped fallback behavior.

#### Scenario: Azure ingestion accepts the batch
- **WHEN** Azure Monitor accepts a valid event batch
- **THEN** the API returns the documented accepted outcome and records delivery telemetry without logging the full event payload

#### Scenario: Azure ingestion fails
- **WHEN** Azure Monitor rejects or cannot receive an event batch
- **THEN** the API returns or records a failure outcome according to the documented retry contract and emits sanitized diagnostic telemetry

#### Scenario: Client is throttled
- **WHEN** the authenticated client exceeds the configured gateway or backend rate limit
- **THEN** the request is rejected with a retryable throttling response and no duplicate custom-table record is intentionally created

### Requirement: Separation of telemetry streams
The system SHALL keep operational telemetry and business/audit events logically separated by ingestion path, schema, destination table, access guidance, retention guidance, and sampling behavior.

#### Scenario: Query operational data
- **WHEN** an operator runs the documented operational KQL queries
- **THEN** traces, exceptions, dependencies, and technical logs are available without relying on the custom business-event table

#### Scenario: Query business-event data
- **WHEN** an operator runs the documented business-event KQL query
- **THEN** approved domain records are available from the dedicated custom table without copying full operational payloads

### Requirement: Repeatable Azure verification
The system SHALL provide a documented verification procedure covering KQL queries, workbook visibility, alert behavior, retention, RBAC, network/allowlisting assumptions, and ingestion-volume cost review.

#### Scenario: Complete the Azure acceptance run
- **WHEN** an operator deploys the POC to an approved Azure environment and runs the verification procedure
- **THEN** the procedure records evidence for each required telemetry journey and identifies any unverified workspace, security, alerting, retention, or cost control

### Requirement: Support-status disclosure
The system SHALL document the support classification of the simulator instrumentation, controlled exporter, and Azure ingestion route and SHALL state that the POC does not validate a native Swift/iOS exporter.

#### Scenario: Review implementation support status
- **WHEN** an operator reviews the POC documentation
- **THEN** each material telemetry component is identified as generally available, preview, community-supported, or customer-maintained based on sources checked during implementation

