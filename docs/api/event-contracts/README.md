# Event contracts

Domain events are written to `outbox_events` in the same transaction as the change, then delivered at least once by the worker (Phase 5).

## Envelope (JSON Schema: [envelope.schema.json](envelope.schema.json))

| Field            | Type      | Notes                                                               |
| ---------------- | --------- | ------------------------------------------------------------------- |
| `id`             | string    | Unique. Consumers de-duplicate on it.                               |
| `type`           | string    | `<module>.<entity>.<past-tense-verb>`, e.g. `sales.order.confirmed` |
| `version`        | integer   | Bump on breaking payload changes                                    |
| `organizationId` | string    | Tenant                                                              |
| `occurredAt`     | date-time | —                                                                   |
| `actor`          | object    | `{ type: USER \| SYSTEM \| AI \| API_KEY, id }`                     |
| `data`           | object    | Event-specific payload (ids plus the changed facts, never secrets)  |

## Catalog

| Type                                  | Emitted when                       | Phase |
| ------------------------------------- | ---------------------------------- | ----- |
| `platform.member.invited`             | Invitation created                 | 5     |
| `sales.quote.approval_requested`      | Discount exceeds policy            | 9     |
| `sales.order.confirmed`               | Order confirmed                    | 9     |
| `inventory.stock.below_reorder_point` | Movement crosses the reorder point | 10    |
| `procurement.po.approved`             | PO approved                        | 11    |
| `production.work_order.completed`     | Work order completed               | 12    |
| `quality.inspection.failed`           | Inspection failed                  | 13    |
| `fulfillment.shipment.delivered`      | POD recorded                       | 14    |
