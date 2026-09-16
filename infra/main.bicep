targetScope = 'resourceGroup'

@description('Azure region for POC-scoped resources.')
param location string = resourceGroup().location

@minLength(3)
@maxLength(20)
@description('Lowercase prefix used for POC-scoped resource names.')
param namePrefix string

@description('Resource ID of the approved existing Log Analytics workspace.')
param logAnalyticsWorkspaceResourceId string

@description('Resource ID of the approved existing API Management service.')
param apimServiceResourceId string

@description('Resource ID of an approved existing Container Apps managed environment. Leave empty to create a POC-scoped environment.')
param managedEnvironmentResourceId string = ''

@description('Resource ID of the private DNS zone for a reused internal Container Apps environment.')
param managedEnvironmentPrivateDnsZoneResourceId string = ''

@description('Static IP of a reused internal Container Apps environment.')
param managedEnvironmentStaticIp string = ''

@description('Resource ID of the approved existing Azure Container Registry.')
param containerRegistryResourceId string

@description('OCI image for the governed backend.')
param backendImage string

@description('OCI image for the controlled OpenTelemetry Collector.')
param collectorImage string

@secure()
@description('Shared value injected by APIM and validated by the backend.')
param apimBackendTrustValue string

@secure()
@description('Subscription/API token accepted by the APIM OTLP endpoint.')
param otlpClientToken string

@description('OpenID Connect metadata URL for the external client identity provider.')
param clientOpenIdConfigUrl string

@description('Expected audience for external client access tokens.')
param clientAudience string

@description('Whether a separate DCE is required for the approved network design.')
param deployDataCollectionEndpoint bool = true

var tableName = 'ExternalMobileEvents_CL'
var streamName = 'Custom-ExternalMobileEvents'
var applicationInsightsName = '${namePrefix}-appi'
var environmentName = '${namePrefix}-cae'
var backendName = '${namePrefix}-backend'
var collectorName = '${namePrefix}-collector'
var dcrName = '${namePrefix}-dcr'
var dceName = '${namePrefix}-dce'
var containerPullIdentityName = '${namePrefix}-pull-mi'
var useExistingManagedEnvironment = !empty(managedEnvironmentResourceId)

resource workspace 'Microsoft.OperationalInsights/workspaces@2022-10-01' existing = {
  scope: resourceGroup(
    split(logAnalyticsWorkspaceResourceId, '/')[2],
    split(logAnalyticsWorkspaceResourceId, '/')[4]
  )
  name: split(logAnalyticsWorkspaceResourceId, '/')[8]
}

resource containerRegistry 'Microsoft.ContainerRegistry/registries@2023-07-01' existing = {
  scope: resourceGroup(
    split(containerRegistryResourceId, '/')[2],
    split(containerRegistryResourceId, '/')[4]
  )
  name: split(containerRegistryResourceId, '/')[8]
}

resource applicationInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: applicationInsightsName
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: workspace.id
    DisableLocalAuth: true
    IngestionMode: 'LogAnalytics'
  }
}

module customTable 'modules/custom-table.bicep' = {
  name: 'create-custom-table'
  scope: resourceGroup(
    split(logAnalyticsWorkspaceResourceId, '/')[2],
    split(logAnalyticsWorkspaceResourceId, '/')[4]
  )
  params: {
    workspaceName: split(logAnalyticsWorkspaceResourceId, '/')[8]
    tableName: tableName
  }
}

resource dataCollectionEndpoint 'Microsoft.Insights/dataCollectionEndpoints@2023-03-11' = if (deployDataCollectionEndpoint) {
  name: dceName
  location: location
  properties: {
    networkAcls: {
      publicNetworkAccess: 'Enabled'
    }
  }
}

resource dataCollectionRule 'Microsoft.Insights/dataCollectionRules@2023-03-11' = {
  name: dcrName
  location: location
  kind: 'Direct'
  properties: {
    dataCollectionEndpointId: deployDataCollectionEndpoint ? dataCollectionEndpoint.id : null
    streamDeclarations: {
      '${streamName}': {
        columns: [
          { name: 'TimeGenerated', type: 'datetime' }
          { name: 'EventType', type: 'string' }
          { name: 'SchemaVersion', type: 'string' }
          { name: 'EventId', type: 'string' }
          { name: 'CorrelationId', type: 'string' }
          { name: 'ClientSessionId', type: 'string' }
          { name: 'ApplicationVersion', type: 'string' }
          { name: 'Outcome', type: 'string' }
          { name: 'DurationMs', type: 'long' }
          { name: 'IngestionSource', type: 'string' }
        ]
      }
    }
    destinations: {
      logAnalytics: [
        {
          name: 'approved-workspace'
          workspaceResourceId: workspace.id
        }
      ]
    }
    dataFlows: [
      {
        streams: [streamName]
        destinations: ['approved-workspace']
        outputStream: 'Custom-${tableName}'
        transformKql: 'source'
      }
    ]
  }
  dependsOn: [customTable]
}

resource managedEnvironment 'Microsoft.App/managedEnvironments@2024-03-01' = if (!useExistingManagedEnvironment) {
  name: environmentName
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: workspace.properties.customerId
        sharedKey: workspace.listKeys().primarySharedKey
      }
    }
    zoneRedundant: false
  }
}

var effectiveManagedEnvironmentId = useExistingManagedEnvironment
  ? managedEnvironmentResourceId
  : managedEnvironment.id

resource containerPullIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: containerPullIdentityName
  location: location
}

module containerAppsDns 'modules/container-apps-dns.bicep' = if (useExistingManagedEnvironment) {
  name: 'configure-container-apps-dns'
  scope: resourceGroup(
    split(managedEnvironmentPrivateDnsZoneResourceId, '/')[2],
    split(managedEnvironmentPrivateDnsZoneResourceId, '/')[4]
  )
  params: {
    privateDnsZoneName: split(managedEnvironmentPrivateDnsZoneResourceId, '/')[8]
    managedEnvironmentStaticIp: managedEnvironmentStaticIp
    backendName: backendName
    collectorName: collectorName
  }
}

module registryPullRole 'modules/acr-pull.bicep' = {
  name: 'grant-registry-pull'
  scope: resourceGroup(
    split(containerRegistryResourceId, '/')[2],
    split(containerRegistryResourceId, '/')[4]
  )
  params: {
    registryName: split(containerRegistryResourceId, '/')[8]
    principalId: containerPullIdentity.properties.principalId
  }
}

resource collector 'Microsoft.App/containerApps@2024-03-01' = {
  name: collectorName
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${containerPullIdentity.id}': {}
    }
  }
  properties: {
    managedEnvironmentId: effectiveManagedEnvironmentId
    configuration: {
      activeRevisionsMode: 'Single'
      registries: [
        {
          server: containerRegistry.properties.loginServer
          identity: containerPullIdentity.id
        }
      ]
      ingress: {
        external: false
        targetPort: 4318
        transport: 'http'
        allowInsecure: false
      }
      secrets: [
        {
          name: 'appinsights-connection'
          value: applicationInsights.properties.ConnectionString
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'collector'
          image: collectorImage
          env: [
            {
              name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
              secretRef: 'appinsights-connection'
            }
          ]
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          probes: [
            {
              type: 'Liveness'
              httpGet: {
                path: '/'
                port: 13133
                scheme: 'HTTP'
              }
              initialDelaySeconds: 10
              periodSeconds: 10
            }
          ]
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 2
      }
    }
  }
  dependsOn: [containerAppsDns, registryPullRole]
}

resource backend 'Microsoft.App/containerApps@2024-03-01' = {
  name: backendName
  location: location
  identity: {
    type: 'SystemAssigned, UserAssigned'
    userAssignedIdentities: {
      '${containerPullIdentity.id}': {}
    }
  }
  properties: {
    managedEnvironmentId: effectiveManagedEnvironmentId
    configuration: {
      activeRevisionsMode: 'Single'
      registries: [
        {
          server: containerRegistry.properties.loginServer
          identity: containerPullIdentity.id
        }
      ]
      ingress: {
        external: false
        targetPort: 3001
        transport: 'http'
        allowInsecure: false
      }
      secrets: [
        {
          name: 'apim-trust'
          value: apimBackendTrustValue
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'backend'
          image: backendImage
          env: [
            { name: 'POC_MODE', value: 'azure' }
            { name: 'BACKEND_HOST', value: '0.0.0.0' }
            { name: 'BACKEND_PORT', value: '3001' }
            { name: 'LOCAL_AUTH_TOKEN', value: 'not-used-in-azure-mode' }
            { name: 'OTEL_SERVICE_NAME', value: 'governed-backend' }
            {
              name: 'OTEL_EXPORTER_OTLP_ENDPOINT'
              value: 'https://${collector.properties.configuration.ingress.fqdn}'
            }
            { name: 'APIM_TRUST_HEADER_NAME', value: 'x-apim-authenticated' }
            { name: 'APIM_TRUST_HEADER_VALUE', secretRef: 'apim-trust' }
            {
              name: 'AZURE_LOGS_ENDPOINT'
              value: deployDataCollectionEndpoint
                ? dataCollectionEndpoint!.properties.logsIngestion.endpoint
                : dataCollectionRule.properties.endpoints.logsIngestion
            }
            {
              name: 'AZURE_DCR_IMMUTABLE_ID'
              value: dataCollectionRule.properties.immutableId
            }
            { name: 'AZURE_DCR_STREAM_NAME', value: streamName }
          ]
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          probes: [
            {
              type: 'Liveness'
              httpGet: { path: '/health', port: 3001, scheme: 'HTTP' }
              initialDelaySeconds: 10
              periodSeconds: 10
            }
            {
              type: 'Readiness'
              httpGet: { path: '/ready', port: 3001, scheme: 'HTTP' }
              initialDelaySeconds: 10
              periodSeconds: 10
            }
          ]
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 3
        rules: [
          {
            name: 'http-scaling'
            http: {
              metadata: {
                concurrentRequests: '50'
              }
            }
          }
        ]
      }
    }
  }
  dependsOn: [containerAppsDns, registryPullRole]
}

resource ingestionRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(dataCollectionRule.id, backend.id, 'monitoring-metrics-publisher')
  scope: dataCollectionRule
  properties: {
    principalId: backend.identity.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      '3913510d-42f4-4e42-8a64-420c390055eb'
    )
  }
}

module apim 'modules/apim.bicep' = {
  name: 'configure-apim'
  scope: resourceGroup(
    split(apimServiceResourceId, '/')[2],
    split(apimServiceResourceId, '/')[4]
  )
  params: {
    apimServiceName: split(apimServiceResourceId, '/')[8]
    backendUrl: 'https://${backend.properties.configuration.ingress.fqdn}'
    collectorUrl: 'https://${collector.properties.configuration.ingress.fqdn}'
    backendTrustValue: apimBackendTrustValue
    otlpClientToken: otlpClientToken
    clientOpenIdConfigUrl: clientOpenIdConfigUrl
    clientAudience: clientAudience
    applicationInsightsResourceId: applicationInsights.id
    applicationInsightsInstrumentationKey: applicationInsights.properties.InstrumentationKey
  }
}

output backendContainerAppName string = backend.name
output collectorContainerAppName string = collector.name
output applicationInsightsName string = applicationInsights.name
output customTableName string = tableName
output dataCollectionRuleImmutableId string = dataCollectionRule.properties.immutableId
output apimApiPath string = apim.outputs.apiPath
