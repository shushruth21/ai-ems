import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts", "tests/unit/**/*.test.ts"],
    passWithNoTests: true,
  },
  resolve: {
    alias: {
      "server-only": fileURLToPath(import.meta.resolve("@ai-ems/tsconfig/vitest-server-only-stub")),
    },
  },
});
