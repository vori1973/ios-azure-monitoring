import { readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const packages = (await readdir(".local-data")).filter((name) =>
  name.endsWith(".tgz"),
);
if (packages.length !== 1) {
  throw new Error(`Expected one simulator package, found ${packages.length}`);
}
const archive = `.local-data/${packages[0]}`;
const listing = spawnSync("tar", ["-tzf", archive], { encoding: "utf8" });
if (listing.status !== 0) throw new Error(listing.stderr);
if (/backend|gateway|\.env/i.test(listing.stdout)) {
  throw new Error(
    "Simulator package contains backend, gateway, or environment files",
  );
}
const content = spawnSync("tar", ["-xOzf", archive], {
  encoding: "utf8",
  maxBuffer: 20_000_000,
});
if (content.status !== 0) throw new Error(content.stderr);
const prohibited = [
  "AZURE_CLIENT_SECRET",
  "AccountKey=",
  "ingest.monitor.azure.com/dataCollectionRules",
  "AZURE_DCR_IMMUTABLE_ID",
  "AZURE_DCR_STREAM_NAME",
  "APPLICATIONINSIGHTS_CONNECTION_STRING=",
];
const found = prohibited.filter((value) => content.stdout.includes(value));
if (found.length > 0)
  throw new Error(
    `Simulator package contains prohibited values: ${found.join(", ")}`,
  );
console.log(`Simulator package verified: ${archive}`);
