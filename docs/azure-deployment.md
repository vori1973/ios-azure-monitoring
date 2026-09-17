# Azure deployment

## Target topology

The Azure target is an Azure Container Apps environment with two internal-only
apps: the governed backend and the controlled OpenTelemetry Collector. Existing
APIM is the only public entry point. The deployment can reuse an approved
existing Container Apps environment or create a POC-scoped environment. It
references approved existing Log Analytics and Azure Container Registry
resources and creates POC-namespaced Application Insights, custom table,
DCR/DCE, Container Apps, identities, and APIM API.

APIM must have network reachability to the Container Apps environment. The
Collector has `external: false`; unauthenticated public OTLP ingress is not
enabled. The client sends OTLP to APIM with the configured `x-otlp-token`, and
APIM forwards it to the internal Collector.

When reusing an internal environment, the template creates exact
`<poc-backend>.internal` and `<poc-collector>.internal` A records in its
existing private DNS zone. It does not replace shared wildcard records or DNS
links.

## Required inputs and permissions

- Existing APIM, Log Analytics, and Azure Container Registry resource IDs
- Existing private Container Apps environment resource ID when reusing one
- Private DNS zone resource ID and static IP for a reused internal environment
- Approved subscription, resource group, and region
- Immutable backend and Collector OCI image tags
- External-client OpenID Connect metadata URL and audience
- Secure APIM-to-backend trust value and OTLP client token
- Deployment identity permitted to create POC resources and update the selected
  APIM service
- Network approval for APIM to resolve and reach internal Container Apps FQDNs

The backend managed identity receives only **Monitoring Metrics Publisher**
(`3913510d-42f4-4e42-8a64-420c390055eb`) scoped to the POC DCR.

## Preview and deploy

Copy `infra/main.parameters.example.json` outside source control or provide
secure values through your deployment system. Always preview shared-resource
changes:

```bash
az deployment group what-if \
  --resource-group <poc-resource-group> \
  --template-file infra/main.bicep \
  --parameters @<approved-parameters-file>
```

Review that the preview does not delete or modify unrelated APIM APIs, policies,
workspace tables, retention, RBAC, or network configuration. Deploy only after
approval:

```bash
az deployment group create \
  --resource-group <poc-resource-group> \
  --template-file infra/main.bicep \
  --parameters @<approved-parameters-file>
```

The template intentionally emits no connection string, shared key, trust value,
or client token.

## Image build

Build and push immutable tags for:

```bash
npm run docker:prepare
docker build -f Dockerfile.backend -t <registry>/external-mobile-backend:<tag> .
docker build -f Dockerfile.collector -t <registry>/external-mobile-collector:<tag> .
```

The preparation step compiles the application and creates a disposable npm
cache so the backend image build does not require outbound registry access.

Grant Container Apps pull access using the target registry's approved managed
identity pattern before deployment. The template creates a POC-scoped
user-assigned identity, grants it `AcrPull` on the selected registry, and
configures both apps to use that identity without registry credentials.
