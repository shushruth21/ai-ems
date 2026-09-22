import { createAuthEmulator } from "./server";

const port = Number(process.env.AUTH_EMULATOR_PORT ?? 54321);
const emulator = createAuthEmulator({
  port,
  host: process.env.AUTH_EMULATOR_HOST ?? "127.0.0.1",
  // Local development keeps accounts across restarts; tests leave this unset.
  stateFile: process.env.AUTH_EMULATOR_STATE_FILE || undefined,
  onEmail:
    process.env.AUTH_EMULATOR_LOG_EMAILS === "true"
      ? (email) => {
          // Mirrors the link in supabase/templates/*.html.
          const site = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
          const link = new URL("/auth/confirm", site);
          link.searchParams.set("token_hash", email.tokenHash);
          link.searchParams.set("type", email.type);
          if (email.redirectTo) link.searchParams.set("next", email.redirectTo);
          console.warn(
            `[auth-emulator] ✉  ${email.kind} email to ${email.to}\n    ${link.toString()}`,
          );
        }
      : undefined,
});
const base = await emulator.listen();
console.warn(
  `[auth-emulator] listening on ${base}/auth/v1 (development/test only)` +
    (process.env.AUTH_EMULATOR_STATE_FILE
      ? ` · state: ${process.env.AUTH_EMULATOR_STATE_FILE}`
      : ""),
);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    void emulator.close().finally(() => process.exit(0));
  });
}
