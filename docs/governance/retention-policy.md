# Data retention

| Data                                             | Retention                                     | Deletion                                      |
| ------------------------------------------------ | --------------------------------------------- | --------------------------------------------- |
| Tenant business records                          | For the life of the subscription plus 90 days | Tenant-initiated export, then hard delete     |
| Audit events                                     | 7 years (financial record-keeping)            | Partition drop after the retention period     |
| Stock movements, invoices, payments              | 7 years                                       | Same                                          |
| Notifications                                    | 180 days                                      | Scheduled purge                               |
| Auth events                                      | 1 year                                        | Scheduled purge                               |
| AI prompts and responses (if logging is enabled) | 30 days                                       | Scheduled purge; tenants can opt out entirely |
| Backups                                          | Per Supabase plan (PITR 7–28 days)            | Automatic                                     |

Data subject requests (access or erasure) are handled within 30 days. Business records under a legal hold are pseudonymised instead of deleted.
