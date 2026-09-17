# Personas

See the persona table in [../architecture/blueprint.md §2](../architecture/blueprint.md). Each persona maps to a system role template in `packages/security/src/authorization/permissions.ts`:

| Persona                   | Role template                 |
| ------------------------- | ----------------------------- |
| Owner / Executive         | `owner`                       |
| Tenant admin              | `admin`                       |
| Sales rep / Sales manager | `sales_rep` / `sales_manager` |
| Buyer                     | `buyer`                       |
| Warehouse                 | `warehouse`                   |
| Planner                   | `planner`                     |
| Shop-floor operator       | `operator`                    |
| Quality inspector         | `inspector`                   |
| Finance                   | `finance`                     |
| Auditor / stakeholder     | `viewer`                      |
