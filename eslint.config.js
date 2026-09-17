import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";

import base from "@ai-ems/eslint-config/base";

/**
 * Root-level files only (configs, tests/, tools/). Each workspace in apps/ and
 * packages/ has its own eslint.config.*, resolved per file.
 */
export default defineConfig([
  ...base,
  { languageOptions: { globals: { ...globals.node } } },
  { files: ["tools/**", "tests/**"], rules: { "no-console": "off" } },
  globalIgnores(["apps/**", "packages/*/src/**", "packages/*/tests/**", "packages/*/prisma/**"]),
]);
