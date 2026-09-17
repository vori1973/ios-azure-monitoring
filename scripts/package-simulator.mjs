import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(".local-data/simulator-package");
await rm(root, { recursive: true, force: true });
await mkdir(root, { recursive: true });
await cp("dist/simulator", `${root}/simulator`, { recursive: true });
await mkdir(`${root}/shared`, { recursive: true });
for (const name of ["correlation", "contracts", "telemetry"]) {
  for (const extension of ["js", "js.map", "d.ts"]) {
    await cp(
      `dist/shared/${name}.${extension}`,
      `${root}/shared/${name}.${extension}`,
    );
  }
}

const sourcePackage = JSON.parse(await readFile("package.json", "utf8"));
const allowedDependencies = Object.fromEntries(
  Object.entries(sourcePackage.dependencies).filter(([name]) =>
    [
      "@opentelemetry/api",
      "@opentelemetry/core",
      "@opentelemetry/exporter-trace-otlp-http",
      "@opentelemetry/resources",
      "@opentelemetry/sdk-trace-base",
      "@opentelemetry/sdk-trace-node",
      "@opentelemetry/semantic-conventions",
      "zod",
    ].includes(name),
  ),
);
await writeFile(
  `${root}/package.json`,
  JSON.stringify(
    {
      name: "external-mobile-telemetry-simulator",
      version: sourcePackage.version,
      type: "module",
      bin: { "mobile-telemetry-simulator": "simulator/index.js" },
      dependencies: allowedDependencies,
    },
    null,
    2,
  ),
);

const result = spawnSync("npm", ["pack", "--pack-destination", ".."], {
  cwd: root,
  encoding: "utf8",
});
process.stdout.write(result.stdout);
process.stderr.write(result.stderr);
if (result.status !== 0) process.exitCode = result.status ?? 1;
