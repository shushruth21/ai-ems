import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { globals: true, environment: "node", include: ["src/**/*.test.ts"] },
  resolve: {
    alias: {
      "server-only": fileURLToPath(import.meta.resolve("@ai-ems/tsconfig/vitest-server-only-stub")),
    },
  },
});
