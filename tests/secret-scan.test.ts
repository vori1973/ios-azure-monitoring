import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import { describe, expect, it } from "vitest";

describe("secret scanner", () => {
  it("detects a credential-shaped fixture", async () => {
    const directory = await mkdtemp(join(tmpdir(), "telemetry-secret-scan-"));
    const key = ["AZURE", "CLIENT", "SECRET"].join("_");
    await writeFile(join(directory, "fixture.txt"), `${key}=not-a-real-secret`);
    const result = spawnSync(
      process.execPath,
      ["scripts/scan-secrets.mjs", directory],
      {
        encoding: "utf8",
      },
    );
    await rm(directory, { recursive: true });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Potential secrets detected");
  });
});
