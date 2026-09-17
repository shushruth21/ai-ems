import { defineConfig } from "vitest/config";

/** Integration tests need a PostgreSQL server: TEST_DATABASE_URL=postgresql://… */
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
