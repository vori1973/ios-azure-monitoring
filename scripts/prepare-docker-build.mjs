import { cp, mkdir, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const buildDirectory = ".docker-build";
const seedDirectory = `${buildDirectory}/seed`;
const cacheDirectory = `${buildDirectory}/npm-cache`;

await rm(seedDirectory, { force: true, recursive: true });
await mkdir(seedDirectory, { recursive: true });
await mkdir(cacheDirectory, { recursive: true });
await Promise.all(
  ["package.json", "package-lock.json"].map((file) =>
    cp(file, `${seedDirectory}/${file}`),
  ),
);

const install = spawnSync(
  process.platform === "win32" ? "npm.cmd" : "npm",
  [
    "ci",
    "--omit=dev",
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
    "--cache",
    "../npm-cache",
  ],
  {
    cwd: seedDirectory,
    encoding: "utf8",
    stdio: "inherit",
  },
);

if (install.status !== 0) {
  await rm(buildDirectory, { force: true, recursive: true });
  process.exit(install.status ?? 1);
}

await rm(`${seedDirectory}/node_modules`, { force: true, recursive: true });
