/** Rules shared by every AI EMS workspace. */
export const sharedRules = {
  "no-console": ["warn", { allow: ["warn", "error"] }],
  eqeqeq: ["error", "always"],
  "@typescript-eslint/no-unused-vars": [
    "error",
    { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
  ],
  "@typescript-eslint/consistent-type-imports": "error",
  "@typescript-eslint/no-explicit-any": "error",
};

export const sharedIgnores = [
  "**/node_modules/**",
  "**/.next/**",
  "**/.turbo/**",
  "**/dist/**",
  "**/coverage/**",
  "**/src/generated/**",
  "**/next-env.d.ts",
];
