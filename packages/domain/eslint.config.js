import { defineConfig } from "eslint/config";

import base from "@ai-ems/eslint-config/base";

export default defineConfig([
  ...base,
  {
    // The domain layer is pure: no framework, database or network imports.
    files: ["src/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["next", "next/*", "react", "react-*"],
              message: "domain must stay framework-free",
            },
            {
              group: ["@ai-ems/*", "@prisma/*", "@supabase/*", "pg"],
              message: "domain must not depend on I/O packages",
            },
          ],
        },
      ],
    },
  },
]);
