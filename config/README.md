# config/

Environment configuration templates. Values are **validated at boot** by `@ai-ems/config` (Zod). Secrets are never committed; set them in Vercel and GitHub environments.

| File                                  | Used by                                                |
| ------------------------------------- | ------------------------------------------------------ |
| `../.env.example`                     | Local development (copy to `.env`)                     |
| `environments/staging.env.example`    | Vercel "Preview (main)" + GitHub `staging` environment |
| `environments/production.env.example` | Vercel "Production" + GitHub `production` environment  |

Feature flags are defined in `packages/config/src/flags.ts`. Each has a typed default and can be overridden per environment with `FEATURE_<NAME>=true|false`.
