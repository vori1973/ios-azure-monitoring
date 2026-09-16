import { readFile, readdir, stat } from "node:fs/promises";
import { resolve, relative } from "node:path";

const ignored = new Set([
  ".git",
  "node_modules",
  "dist",
  "coverage",
  ".local-data",
]);
const patterns = [
  /AZURE_CLIENT_SECRET\s*=\s*[^\s<]+/i,
  /Authorization:\s*Bearer\s+[A-Za-z0-9._~-]+/i,
  /AccountKey=[A-Za-z0-9+/=]{20,}/i,
  /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/,
];

async function walk(path) {
  const info = await stat(path);
  if (info.isDirectory()) {
    if (ignored.has(path.split(/[\\/]/).at(-1))) return [];
    const children = await readdir(path);
    return (
      await Promise.all(children.map((child) => walk(resolve(path, child))))
    ).flat();
  }
  return [path];
}

const root = resolve(process.argv[2] ?? ".");
const findings = [];
for (const file of await walk(root)) {
  const content = await readFile(file, "utf8").catch(() => "");
  for (const pattern of patterns) {
    if (pattern.test(content))
      findings.push(`${relative(root, file)}: ${pattern.source}`);
  }
}

if (findings.length > 0) {
  console.error(`Potential secrets detected:\n${findings.join("\n")}`);
  process.exitCode = 1;
}
