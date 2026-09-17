import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PORT ?? 3000);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${port}`;
const emulatorPort = Number(process.env.AUTH_EMULATOR_PORT ?? 54321);

/**
 * The app under test talks to the local Supabase Auth emulator
 * (tools/auth-emulator) and a real PostgreSQL for audit + rate-limit tables.
 * Values below are test-only placeholders, never real secrets.
 */
export const e2eAppEnv: Record<string, string> = {
  ENABLE_UI_PREVIEW: "true",
  NEXT_PUBLIC_APP_URL: baseURL,
  NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${emulatorPort}`,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "e2e-publishable-key",
  SUPABASE_SECRET_KEY: "e2e-secret-key-not-a-real-secret",
  DATABASE_URL:
    process.env.E2E_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/aiems",
  AUTH_RATE_LIMIT_STORE: "postgres",
  FEATURE_OAUTH_GOOGLE: "true",
  FEATURE_OAUTH_MICROSOFT: "false",
};

export default defineConfig({
  testDir: "./tests",
  testMatch: ["e2e/**/*.spec.ts", "security/**/*.spec.ts"],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    // Optional: point at a pre-installed Chromium (e.g. in sandboxes without browser downloads).
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : {},
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : [
        {
          command: "pnpm --filter @ai-ems/auth-emulator start",
          env: { AUTH_EMULATOR_PORT: String(emulatorPort) },
          url: `http://127.0.0.1:${emulatorPort}/auth/v1/health`,
          reuseExistingServer: !process.env.CI,
          timeout: 30_000,
        },
        {
          command: `pnpm --filter @ai-ems/web build && pnpm --filter @ai-ems/web start -p ${port}`,
          env: e2eAppEnv,
          url: `${baseURL}/api/health`,
          reuseExistingServer: !process.env.CI,
          timeout: 240_000,
        },
      ],
});
