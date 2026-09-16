@description('Name of the existing Container Apps private DNS zone.')
param privateDnsZoneName string

@description('Static IP of the internal Container Apps managed environment.')
param managedEnvironmentStaticIp string

@description('POC backend Container App name.')
param backendName string

@description('POC Collector Container App name.')
param collectorName string

resource privateDnsZone 'Microsoft.Network/privateDnsZones@2024-06-01' existing = {
  name: privateDnsZoneName
}

resource backendRecord 'Microsoft.Network/privateDnsZones/A@2024-06-01' = {
  parent: privateDnsZone
  name: '${backendName}.internal'
  properties: {
    ttl: 300
    aRecords: [
      {
        ipv4Address: managedEnvironmentStaticIp
      }
    ]
  }
}

resource collectorRecord 'Microsoft.Network/privateDnsZones/A@2024-06-01' = {
  parent: privateDnsZone
  name: '${collectorName}.internal'
  properties: {
    ttl: 300
    aRecords: [
      {
        ipv4Address: managedEnvironmentStaticIp
      }
    ]
  }
}
