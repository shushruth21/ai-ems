import { defineConfig } from "eslint/config";

import base from "@ai-ems/eslint-config/base";

export default defineConfig([
  ...base,
  { files: ["prisma/**/*.ts"], rules: { "no-console": "off" } },
]);
