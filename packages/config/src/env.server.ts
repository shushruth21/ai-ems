import "server-only";
import { parseServerEnv, type ServerEnv } from "./env";

let cached: ServerEnv | undefined;

/** Server-only configuration (secrets). Throws on first use if invalid. */
export function env(): ServerEnv {
  cached ??= parseServerEnv();
  return cached;
}
