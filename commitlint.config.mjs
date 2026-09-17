/** Conventional Commits: feat(sales): add quote approval */
const config = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "scope-enum": [
      1,
      "always",
      [
        "platform",
        "auth",
        "ui",
        "crm",
        "catalog",
        "sales",
        "inventory",
        "procurement",
        "production",
        "quality",
        "fulfillment",
        "finance",
        "people",
        "service",
        "partners",
        "marketing",
        "collab",
        "ai",
        "db",
        "infra",
        "deps",
        "docs",
      ],
    ],
  },
};
export default config;
