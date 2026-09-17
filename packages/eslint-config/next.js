import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

import { sharedIgnores, sharedRules } from "./rules.js";

/** Next.js applications. */
export default defineConfig([
  ...nextVitals,
  ...nextTs,
  { rules: sharedRules },
  globalIgnores(sharedIgnores),
]);
