import { createAuthEmulator } from "./server";

const port = Number(process.env.AUTH_EMULATOR_PORT ?? 54321);
const emulator = createAuthEmulator({ port, host: process.env.AUTH_EMULATOR_HOST ?? "127.0.0.1" });
const base = await emulator.listen();
console.warn(`[auth-emulator] listening on ${base}/auth/v1 (test use only)`);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    void emulator.close().finally(() => process.exit(0));
  });
}
