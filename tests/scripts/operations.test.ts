import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

import { describe, expect, it } from "vitest";

describe("operational scripts", () => {
  it("cleanup removes only named POC files", async () => {
    const directory = await mkdtemp(join(tmpdir(), "telemetry-cleanup-"));
    await mkdir(join(directory, ".local-data"), { recursive: true });
    await writeFile(
      join(directory, ".local-data/business-events.ndjson"),
      "generated",
    );
    await mkdir(join(directory, ".docker-build"), { recursive: true });
    await writeFile(join(directory, ".docker-build/cache-entry"), "generated");
    await writeFile(join(directory, ".local-data/unrelated.txt"), "preserve");
    const result = spawnSync(
      process.execPath,
      [resolve("scripts/cleanup-local.mjs")],
      { cwd: directory, encoding: "utf8" },
    );
    expect(result.status).toBe(0);
    expect(
      await readFile(join(directory, ".local-data/unrelated.txt"), "utf8"),
    ).toBe("preserve");
    await expect(
      readFile(join(directory, ".local-data/business-events.ndjson"), "utf8"),
    ).rejects.toThrow();
    await expect(
      readFile(join(directory, ".docker-build/cache-entry"), "utf8"),
    ).rejects.toThrow();
    await rm(directory, { recursive: true });
  });

  it("Azure acceptance fails fast with actionable missing configuration", () => {
    const result = spawnSync(
      process.execPath,
      [resolve("scripts/azure-acceptance.mjs")],
      {
        cwd: dirname(resolve("package.json")),
        encoding: "utf8",
        env: { PATH: process.env.PATH ?? "" },
      },
    );
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Missing acceptance configuration");
  });
});
