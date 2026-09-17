import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

import { sharedIgnores, sharedRules } from "./rules.js";

/** TypeScript libraries without React. */
export default defineConfig([
  ...tseslint.configs.recommended,
  { rules: sharedRules },
  globalIgnores(sharedIgnores),
]);
