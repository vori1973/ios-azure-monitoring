param workspaceName string
param tableName string

resource workspace 'Microsoft.OperationalInsights/workspaces@2022-10-01' existing = {
  name: workspaceName
}

resource customTable 'Microsoft.OperationalInsights/workspaces/tables@2022-10-01' = {
  parent: workspace
  name: tableName
  properties: {
    plan: 'Analytics'
    retentionInDays: 30
    totalRetentionInDays: 30
    schema: {
      name: tableName
      columns: [
        { name: 'TimeGenerated', type: 'dateTime' }
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
}
