# External Mobile Telemetry POC

This project demonstrates the recommended two-stream Azure Monitor architecture
for an external client that behaves like an iOS application. It validates the
client contract, trust boundaries, telemetry correlation, data governance, and
Azure integration without claiming native Swift SDK or iOS runtime validation.

## Architecture at a glance

```text
Operational telemetry
External simulator -> APIM/controlled Collector -> Application Insights
                                                   -> Log Analytics workspace

Governed business events
External simulator -> APIM -> governed backend -> Logs Ingestion API
                                                -> DCR -> ExternalMobileEvents_CL
```

The two streams share W3C trace context and an opaque correlation ID, but they
remain separated by ingestion path, schema, destination, access, retention,
and sampling behavior.

- The simulator uses the standard OpenTelemetry JavaScript SDK and sends
  OTLP/HTTP only to a controlled endpoint.
- APIM enforces identity, content type, request-size, throttling, correlation,
  and routing controls.
- The backend performs authoritative closed-schema validation, sensitive-data
  rejection, sanitization, enrichment, and bounded retries.
- Only the backend uses Microsoft `@azure/monitor-ingestion` and
  `@azure/identity` to reach the DCR with managed identity.
- Azure credentials, workspace keys, DCR tokens, and backend configuration are
  prohibited in the simulator package.
- The Azure backend and Collector use internal-only Container Apps ingress;
  APIM is the public boundary.

See [POC architecture](docs/architecture.md) for the complete Mermaid diagram,
SDK placement, trust boundaries, and local-to-Azure mapping.

## What this POC validates

- Successful correlated request and approved business-event ingestion
- Handled client exception and failed backend dependency telemetry
- Sensitive and unknown event rejection without prohibited-value persistence
- Gateway and backend throttling behavior without intentional duplicates
- Explicit local versus Azure runtime modes with no silent fallback
- Client package credential isolation
- Repeatable KQL, workbook, alert, RBAC, retention, network, and cost checks

Native mobile offline buffering, application lifecycle hooks, background
execution, durable mobile retry queues, and Swift exporter reliability remain
outside this POC.

## Documentation

| Document                                                                     | Purpose                                                                           |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| [Azure Monitor iOS recommendation](docs/azure-monitor-ios-recommendation.md) | Original recommendation, rationale, guardrails, and mapping to this POC           |
| [POC architecture](docs/architecture.md)                                     | Local and Azure diagrams, trust boundaries, SDKs, credentials, and data paths     |
| [SDK references](docs/sdk-references.md)                                     | Microsoft and OpenTelemetry packages, support status, and actual POC usage        |
| [Azure deployment](docs/azure-deployment.md)                                 | Required resources, permissions, image build, what-if, and deployment             |
| [Azure verification](docs/azure-verification.md)                             | Acceptance runner, KQL, workbook, alerts, and operator checklist                  |
| [Validation record](docs/validation.md)                                      | Commands and checks actually executed                                             |
| [Rollback](docs/rollback.md)                                                 | POC-only cleanup that preserves shared APIM, workspace, environment, and registry |
| [OpenSpec change](openspec/changes/add-ios-telemetry-poc)                    | Approved proposal, design, capability specification, and task status              |

## Quick start

Prerequisites:

```bash
node --version # 22 through 25
docker version
npm ci
cp .env.example .env
```

Run the local topology:

```bash
npm run local:up
npm run journey -- success
npm run local:down
```

Local mode writes disposable output under `.local-data/`. `local:up` prepares
an offline npm cache before building images, so Docker does not need outbound
package-registry access during the image build.

Run repository validation:

```bash
npm run build
npm run typecheck
npm run lint
npm run format:check
npm test
npm run test:coverage
npm run scan:secrets
npm run infra:validate
```

Build and inspect the portable simulator package:

```bash
npm run package:simulator
npm run check:simulator-package
```

Always preview Azure changes before deployment:

```bash
az deployment group what-if \
  --resource-group <poc-resource-group> \
  --template-file infra/main.bicep \
  --parameters @<approved-parameters-file>
```

## Troubleshooting

- **Docker unavailable:** enable Docker Desktop integration for this WSL
  distribution and confirm `docker version` shows client and server.
- **Azure mode rejects startup:** provide all Azure-only settings; Azure mode
  never falls back to local files.
- **Telemetry export fails:** verify the APIM OTLP route, `x-otlp-token`,
  private DNS, APIM-to-Container-Apps reachability, and Collector health.
- **Business event is accepted but not queryable:** use the bounded acceptance
  runner and ingestion diagnostics because API acceptance can precede table
  visibility.
- **APIM returns 401:** use a valid API access token for business routes or the
  POC OTLP token only for `/v1/traces`.
- **Sensitive event returns 400:** expected; diagnostics contain the prohibited
  field path and reason code, never its value.

## Project workflow

GitHub issues define problems and ownership. OpenSpec defines accepted behavior
and proposed changes. Implementation pull requests must link both.

Before contributing:

1. Read `AGENTS.md`.
2. Select or create the related GitHub issue.
3. Follow the OpenSpec workflow for substantive behavior changes.
4. Report only validation that was actually performed.
