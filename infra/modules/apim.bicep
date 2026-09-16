@description('Name of the existing API Management service in this resource group.')
param apimServiceName string

@description('Internal governed backend URL.')
param backendUrl string

@description('Internal controlled Collector URL.')
param collectorUrl string

@secure()
param backendTrustValue string

@secure()
param otlpClientToken string

param clientOpenIdConfigUrl string

param clientAudience string

param applicationInsightsResourceId string

@secure()
param applicationInsightsInstrumentationKey string

resource apim 'Microsoft.ApiManagement/service@2024-05-01' existing = {
  name: apimServiceName
}

resource api 'Microsoft.ApiManagement/service/apis@2024-05-01' = {
  parent: apim
  name: 'external-mobile-telemetry-poc'
  properties: {
    displayName: 'External Mobile Telemetry POC'
    path: 'external-mobile-telemetry'
    protocols: ['https']
    subscriptionRequired: false
    serviceUrl: backendUrl
  }
}

resource eventsOperation 'Microsoft.ApiManagement/service/apis/operations@2024-05-01' = {
  parent: api
  name: 'submit-business-event'
  properties: {
    displayName: 'Submit business event'
    method: 'POST'
    urlTemplate: '/api/events'
    responses: []
  }
}

resource dependencyOperation 'Microsoft.ApiManagement/service/apis/operations@2024-05-01' = {
  parent: api
  name: 'dependency-demo'
  properties: {
    displayName: 'Dependency demonstration'
    method: 'GET'
    urlTemplate: '/api/dependency'
    templateParameters: []
    responses: []
  }
}

resource otlpOperation 'Microsoft.ApiManagement/service/apis/operations@2024-05-01' = {
  parent: api
  name: 'submit-otlp-traces'
  properties: {
    displayName: 'Submit controlled OTLP traces'
    method: 'POST'
    urlTemplate: '/v1/traces'
    responses: []
  }
}

resource policy 'Microsoft.ApiManagement/service/apis/policies@2024-05-01' = {
  parent: api
  name: 'policy'
  properties: {
    format: 'rawxml'
    value: replace(
      replace(
        replace(
          replace(
            replace(
              loadTextContent('../../config/apim/policy.xml'),
              '{{BACKEND_URL}}',
              backendUrl
            ),
            '{{COLLECTOR_URL}}',
            collectorUrl
          ),
          '{{BACKEND_TRUST_VALUE}}',
          backendTrustValue
        ),
        '{{CLIENT_OPENID_CONFIG_URL}}',
        clientOpenIdConfigUrl
      ),
      '{{CLIENT_AUDIENCE}}',
      clientAudience
    )
  }
  dependsOn: [eventsOperation, dependencyOperation, otlpOperation, otlpNamedValue]
}

resource otlpNamedValue 'Microsoft.ApiManagement/service/namedValues@2024-05-01' = {
  parent: apim
  name: 'external-mobile-otlp-token'
  properties: {
    displayName: 'external-mobile-otlp-token'
    secret: true
    value: otlpClientToken
  }
}

resource applicationInsightsLogger 'Microsoft.ApiManagement/service/loggers@2024-05-01' = {
  parent: apim
  name: 'external-mobile-telemetry-appinsights'
  properties: {
    loggerType: 'applicationInsights'
    resourceId: applicationInsightsResourceId
    isBuffered: true
    credentials: {
      instrumentationKey: applicationInsightsInstrumentationKey
    }
  }
}

resource apiDiagnostic 'Microsoft.ApiManagement/service/apis/diagnostics@2024-05-01' = {
  parent: api
  name: 'applicationinsights'
  properties: {
    loggerId: applicationInsightsLogger.id
    alwaysLog: 'allErrors'
    logClientIp: false
    httpCorrelationProtocol: 'W3C'
    verbosity: 'information'
    sampling: {
      samplingType: 'fixed'
      percentage: 100
    }
    frontend: {
      request: {
        headers: ['traceparent', 'tracestate', 'x-correlation-id']
        body: {
          bytes: 0
        }
      }
      response: {
        headers: []
        body: {
          bytes: 0
        }
      }
    }
    backend: {
      request: {
        headers: ['traceparent', 'tracestate', 'x-correlation-id']
        body: {
          bytes: 0
        }
      }
      response: {
        headers: []
        body: {
          bytes: 0
        }
      }
    }
  }
}

output apiPath string = api.properties.path
