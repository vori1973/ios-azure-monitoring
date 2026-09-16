import { readdir, rm } from "node:fs/promises";

const generatedPaths = [
  { path: ".docker-build", recursive: true },
  { path: ".local-data/business-events.ndjson", recursive: false },
  { path: ".local-data/traces.json", recursive: false },
  { path: ".local-data/traces.json-rotated", recursive: false },
  { path: ".local-data/simulator-package", recursive: true },
];

const packagedArchives = (await readdir(".local-data").catch(() => [])).filter(
  (name) =>
    name.startsWith("external-mobile-telemetry-simulator-") &&
    name.endsWith(".tgz"),
);

await Promise.all(
  [
    ...generatedPaths,
    ...packagedArchives.map((name) => ({
      path: `.local-data/${name}`,
      recursive: false,
    })),
  ].map(({ path, recursive }) =>
    rm(path, { force: true, recursive }).catch((error) => {
      console.error(
        `Failed to remove ${path}: ${error instanceof Error ? error.message : "unknown"}`,
      );
      process.exitCode = 1;
    }),
  ),
);
