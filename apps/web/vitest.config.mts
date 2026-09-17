import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "node",
    include: [
      "src/**/*.test.{ts,tsx}",
      "tests/unit/**/*.test.{ts,tsx}",
      "tests/component/**/*.test.{ts,tsx}",
    ],
    setupFiles: ["./tests/setup.ts"],
    coverage: { provider: "v8", include: ["src/**"] },
  },
  resolve: {
    tsconfigPaths: true,
    alias: {
      "server-only": fileURLToPath(import.meta.resolve("@ai-ems/tsconfig/vitest-server-only-stub")),
    },
  },
});
