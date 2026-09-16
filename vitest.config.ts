import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    testTimeout: 15_000,
    hookTimeout: 15_000,
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      thresholds: {
        lines: 80,
        functions: 75,
        statements: 80,
        branches: 75,
      },
    },
    environment: "node",
    restoreMocks: true,
  },
});
