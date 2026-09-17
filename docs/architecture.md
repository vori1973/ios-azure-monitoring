# POC architecture

The POC keeps operational telemetry and governed business events on separate
paths. The TypeScript client behaves like an external iOS application; it does
not validate a native Swift exporter or iOS runtime behavior.

```mermaid
flowchart LR
  subgraph Client["External client trust boundary"]
    S["External TypeScript iOS-like simulator<br/>OpenTelemetry JavaScript SDK<br/>OTLP/HTTP exporter<br/>Azure credentials prohibited"]
  end

  subgraph Local["Local service trust boundary"]
    direction LR
    LG["Local gateway substitute<br/>Auth, size, throttle"]
    LB["Governed backend<br/>OpenTelemetry JavaScript SDK<br/>POC_MODE=local file adapter"]
    LC["OpenTelemetry Collector Contrib 0.136.0<br/>OTLP receiver + file/debug exporters"]
    LT[("traces.json<br/>operational substitute")]
    LE[("business-events.ndjson<br/>ingestion substitute")]

    LG -->|"Forwarded trace context<br/>and authenticated identity"| LB
    LB -->|"Backend operational OTLP/HTTP"| LC
    LC --> LT
    LB -->|"Closed schema; explicit file adapter"| LE
  end

  subgraph Azure["Azure resource trust boundary"]
    direction LR
    subgraph Edge["Existing shared APIM - public boundary"]
      APIM["POC API and policy<br/>OIDC/JWT or x-otlp-token<br/>size, throttle, routing"]
    end

    subgraph ACA["Azure Container Apps - internal ingress only"]
      AB["Governed backend<br/>OpenTelemetry JavaScript SDK<br/>@azure/monitor-ingestion<br/>@azure/identity + managed identity"]
      AC["OpenTelemetry Collector Contrib 0.136.0<br/>OTLP receiver<br/>Azure Monitor exporter"]
    end

    AI["POC workspace-based<br/>Application Insights"]
    DCE["POC DCE / DCR<br/>Logs Ingestion"]
    TABLE[("ExternalMobileEvents_CL")]
    LAW[("Existing shared<br/>Log Analytics workspace")]

    APIM -->|"OTLP route"| AC
    APIM -->|"Business route<br/>internal trust value"| AB
    AB -->|"Backend operational OTLP/HTTP"| AC
    AC -->|"Azure Monitor export"| AI
    APIM -.->|"Sanitized W3C diagnostics"| AI
    AB -->|"Managed identity only<br/>DCR-scoped role"| DCE
    DCE -->|"Closed custom stream"| TABLE
    AI --> LAW
    TABLE --> LAW
  end

  S -->|"Local operational: OTLP/HTTP<br/>traceparent, tracestate,<br/>opaque correlation ID"| LC
  S -->|"Local business: HTTP substitute<br/>local auth token + trace context<br/>+ opaque correlation ID"| LG
  S -->|"Azure operational: OTLP/HTTP over HTTPS<br/>x-otlp-token + trace context"| APIM
  S -->|"Azure business: HTTPS<br/>OIDC access token + trace context<br/>+ opaque correlation ID"| APIM
```

The Microsoft `@azure/monitor-opentelemetry` Node.js distribution is an
authoritative production SDK reference, but it is not installed in this POC.
The simulator and backend use the standard OpenTelemetry JavaScript SDK so both
send operational telemetry through the controlled Collector. The backend uses
Microsoft `@azure/monitor-ingestion` only for governed custom-table delivery.

## Legend and trust model

- Solid arrows are data paths. The dotted arrow is APIM operational
  diagnostics. Operational data lands through Application Insights; approved
  business records land only in `ExternalMobileEvents_CL`.
- `traceparent` and `tracestate` preserve W3C distributed tracing. A separate,
  validated opaque correlation ID joins operational telemetry to the minimized
  business record without copying request payloads.
- Azure service credentials, workspace keys, DCR authorization tokens, client
  secrets, and backend-only configuration are prohibited in the simulator.
  The external client uses only its API identity and the POC OTLP edge token.
- APIM holds edge policy configuration and secure values. The backend alone
  uses managed identity for Logs Ingestion. The Collector receives its
  Application Insights configuration as an Azure Container Apps secret.
- APIM and the Log Analytics workspace are existing shared resources. The
  backend, Collector, Application Insights resource, DCE/DCR, role assignment,
  and custom table are POC-scoped. Direct public ingress to the Azure backend
  and Collector is disabled.

## External-client contract and POC boundary

The external client demonstrated by this POC:

- Sends versioned business-event JSON only to the governed APIM/backend
  endpoint.
- Includes valid API authentication, W3C `traceparent` context, and the
  validated opaque correlation ID.
- Follows the documented payload-size, event-name, schema-version, field-type,
  length, and closed-property restrictions.
- Sends operational telemetry as OTLP/HTTP only to the controlled APIM or
  Collector endpoint.

APIM enforces edge authentication, content type, request size, throttling,
correlation forwarding, and routing. The backend remains authoritative for
schema validation, sensitive-data rejection, sanitization, server enrichment,
and conversion into the exact DCR and `ExternalMobileEvents_CL` schema.

Platform-specific mobile behavior remains outside this POC: offline buffering,
native application lifecycle integration, background execution, mobile-network
retry policy, durable queues, and native exporter reliability. The backend's
bounded Azure ingestion retry behavior is included and tested, but it does not
represent a mobile SDK retry implementation.

## Local-to-Azure mapping

| Concern                 | Local substitute                         | Azure implementation                                             |
| ----------------------- | ---------------------------------------- | ---------------------------------------------------------------- |
| Public policy boundary  | Fastify gateway on `localhost:3000`      | Existing shared APIM with the POC policy                         |
| Governed business API   | Backend container in explicit local mode | Internal Container Apps backend                                  |
| Operational receiver    | Collector on `localhost:4318`            | Internal Container Apps Collector reached through APIM           |
| Operational destination | `.local-data/traces.json`                | POC workspace-based Application Insights in the shared workspace |
| Business destination    | `.local-data/business-events.ndjson`     | Logs Ingestion through POC DCE/DCR to `ExternalMobileEvents_CL`  |
| Azure authorization     | None; Azure credentials are not required | Backend managed identity scoped to the POC DCR                   |

Local file output is selected only by explicit `POC_MODE=local`; Azure mode
never falls back to local files.
