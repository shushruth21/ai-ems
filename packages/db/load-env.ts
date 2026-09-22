/**
 * Loads environment files for database tooling (Prisma config, seed, SQL and
 * WASM migration scripts). pnpm runs these from packages/db, so the repo-root
 * `.env` must be loaded explicitly. Existing process variables always win.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

import { config } from "dotenv";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../..");

config({
  path: [path.join(here, ".env"), path.join(repoRoot, ".env.local"), path.join(repoRoot, ".env")],
  quiet: true,
});
