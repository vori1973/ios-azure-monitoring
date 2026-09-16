# Rollback

1. Export any required POC evidence and confirm its retention destination.
2. Delete the `external-mobile-telemetry-poc` API from the selected APIM
   service, including its policy and POC named value.
3. Delete the POC Container Apps, POC-created managed environment (if any),
   POC pull identity and its `AcrPull` assignment, ingestion role assignment,
   exact POC private DNS A records, DCR, optional DCE, custom table, and
   Application Insights resource by their exact deployment names.
4. Verify the existing APIM service and Log Analytics workspace still exist and
   that any reused Container Apps environment and registry still exist, and
   that unrelated APIs, images, tables, retention, RBAC, alerts, and network
   settings are unchanged.

Use an Azure deployment what-if before deletion. Do not delete the resource
group if it contains shared resources. The rollback boundary is the resources
created by `infra/main.bicep`; the existing APIM service, Log Analytics
workspace, reused Container Apps environment, and registry are never rollback
targets.
