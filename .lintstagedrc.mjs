/**
 * Pre-commit checks for staged files. ESLint resolves each file's nearest
 * eslint.config.* (per-workspace configs) via the v10 lookup flag.
 */
const config = {
  "*.{ts,tsx,mts,js,mjs}": [
    "eslint --flag v10_config_lookup_from_file --fix --max-warnings=0 --no-warn-ignored",
    "prettier --write",
  ],
  "*.{json,md,css,yml,yaml}": ["prettier --write"],
  "packages/db/prisma/schema/*.prisma": () => "pnpm --filter @ai-ems/db db:format",
};
export default config;
