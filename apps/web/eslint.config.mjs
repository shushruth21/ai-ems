import { defineConfig } from "eslint/config";

import next from "@ai-ems/eslint-config/next";

export default defineConfig([
  ...next,
  // Lets Next's rules find the app when ESLint runs from the monorepo root.
  { settings: { next: { rootDir: import.meta.dirname } } },
]);
