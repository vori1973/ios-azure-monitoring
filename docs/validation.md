# Validation record

The following repository-local checks were run during implementation:

```text
npm run typecheck
npm run build
npm test -- --reporter=dot
npm run test:coverage
npm run lint
npm run format:check
npm run scan:secrets
npm run infra:validate
npm run package:simulator
npm run check:simulator-package
openspec validate add-ios-telemetry-poc --strict
otelcol-contrib validate --config config/otel-collector.local.yaml
otelcol-contrib validate --config config/otel-collector.azure.yaml
npm run local:up
npm run journey -- success
npm run journey -- handled-exception
npm run journey -- dependency-failure
npm run journey -- sensitive-event
npm run journey -- unknown-event
npm run journey -- throttling
npm test -- --run tests/local/e2e.test.ts tests/simulator/journeys.test.ts tests/gateway/app.test.ts tests/backend/app.test.ts
npm run local:down
az deployment group what-if --resource-group aaia-dev-rg --template-file infra/main.bicep --parameters <approved-parameters>
```

The Azure what-if run on 2026-09-16 predicted 16 POC-scoped creates, no
deletions or modifications, and left the existing APIM service, Container Apps
environment, Log Analytics workspace, registry, APIs, network, and private DNS
unchanged. The registry `AcrPull` role assignment was reported as unsupported
because its principal ID is created during deployment and cannot be resolved by
what-if.

Azure deployment, APIM connectivity, Log Analytics query visibility, workbook
import, alert firing, RBAC inspection, retention review, and cost evidence
remain environment-dependent and must be recorded in the implementation pull
request after an approved Azure target is supplied.
