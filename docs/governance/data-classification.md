# Data classification

| Class            | Examples                                                                               | Handling                                                                             |
| ---------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| **Restricted**   | Passwords (never stored by us), MFA secrets (Supabase), API key material, service keys | Never logged, never sent to the LLM, never rendered                                  |
| **Confidential** | Customer contact details (email, phone), prices, margins, payroll data                 | Tenant-isolated; masked for roles without reveal permission; minimised in AI prompts |
| **Internal**     | Orders, stock, work orders, audit events                                               | Tenant-isolated; exportable by permitted roles                                       |
| **Public**       | Marketing pages, public product catalogs (if published)                                | —                                                                                    |

## Rules

- **Logs:** structured logs contain ids, not personal data.
- **Test and sample data:** always synthetic. Never copy production data into non-production environments.
- **Third-party material:** never commit proprietary third-party code, assets or data.
