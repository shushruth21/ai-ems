import { defineMachine } from "./state-machine";

export type QuoteStatus =
  "DRAFT" | "PENDING_APPROVAL" | "SENT" | "ACCEPTED" | "REJECTED" | "EXPIRED";
export const quoteMachine = defineMachine<
  QuoteStatus,
  "submit" | "approve" | "reject_approval" | "send" | "accept" | "decline" | "expire" | "revise"
>("Quote", [
  { action: "submit", from: ["DRAFT"], to: "PENDING_APPROVAL", permission: "sales.quote.write" },
  { action: "approve", from: ["PENDING_APPROVAL"], to: "DRAFT", permission: "sales.quote.approve" },
  {
    action: "reject_approval",
    from: ["PENDING_APPROVAL"],
    to: "DRAFT",
    permission: "sales.quote.approve",
  },
  { action: "send", from: ["DRAFT"], to: "SENT", permission: "sales.quote.write" },
  { action: "accept", from: ["SENT"], to: "ACCEPTED", permission: "sales.quote.write" },
  { action: "decline", from: ["SENT"], to: "REJECTED", permission: "sales.quote.write" },
  { action: "expire", from: ["SENT"], to: "EXPIRED" },
  {
    action: "revise",
    from: ["SENT", "REJECTED", "EXPIRED"],
    to: "DRAFT",
    permission: "sales.quote.write",
  },
]);

export type SalesOrderStatus =
  | "DRAFT"
  | "CONFIRMED"
  | "IN_PRODUCTION"
  | "READY"
  | "PARTIALLY_SHIPPED"
  | "SHIPPED"
  | "CLOSED"
  | "CANCELLED";
export const salesOrderMachine = defineMachine<
  SalesOrderStatus,
  "confirm" | "start_production" | "mark_ready" | "ship_partial" | "ship_all" | "close" | "cancel"
>("SalesOrder", [
  { action: "confirm", from: ["DRAFT"], to: "CONFIRMED", permission: "sales.order.confirm" },
  {
    action: "start_production",
    from: ["CONFIRMED"],
    to: "IN_PRODUCTION",
    permission: "production.workorder.write",
  },
  { action: "mark_ready", from: ["CONFIRMED", "IN_PRODUCTION"], to: "READY" },
  {
    action: "ship_partial",
    from: ["READY", "PARTIALLY_SHIPPED", "IN_PRODUCTION"],
    to: "PARTIALLY_SHIPPED",
    permission: "fulfillment.shipment.write",
  },
  {
    action: "ship_all",
    from: ["READY", "PARTIALLY_SHIPPED"],
    to: "SHIPPED",
    permission: "fulfillment.shipment.write",
  },
  { action: "close", from: ["SHIPPED"], to: "CLOSED", permission: "sales.order.write" },
  {
    action: "cancel",
    from: ["DRAFT", "CONFIRMED", "IN_PRODUCTION"],
    to: "CANCELLED",
    permission: "sales.order.cancel",
  },
]);

export type PurchaseOrderStatus =
  | "DRAFT"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "SENT"
  | "PARTIALLY_RECEIVED"
  | "RECEIVED"
  | "CLOSED"
  | "CANCELLED";
export const purchaseOrderMachine = defineMachine<
  PurchaseOrderStatus,
  "submit" | "approve" | "reject" | "send" | "receive_partial" | "receive_all" | "close" | "cancel"
>("PurchaseOrder", [
  { action: "submit", from: ["DRAFT"], to: "PENDING_APPROVAL", permission: "procurement.po.write" },
  {
    action: "approve",
    from: ["PENDING_APPROVAL"],
    to: "APPROVED",
    permission: "procurement.po.approve",
  },
  {
    action: "reject",
    from: ["PENDING_APPROVAL"],
    to: "DRAFT",
    permission: "procurement.po.approve",
  },
  { action: "send", from: ["APPROVED"], to: "SENT", permission: "procurement.po.write" },
  {
    action: "receive_partial",
    from: ["SENT", "PARTIALLY_RECEIVED"],
    to: "PARTIALLY_RECEIVED",
    permission: "procurement.receipt.write",
  },
  {
    action: "receive_all",
    from: ["SENT", "PARTIALLY_RECEIVED"],
    to: "RECEIVED",
    permission: "procurement.receipt.write",
  },
  { action: "close", from: ["RECEIVED"], to: "CLOSED", permission: "procurement.po.write" },
  {
    action: "cancel",
    from: ["DRAFT", "PENDING_APPROVAL", "APPROVED"],
    to: "CANCELLED",
    permission: "procurement.po.write",
  },
]);

export type WorkOrderStatus =
  "PLANNED" | "RELEASED" | "IN_PROGRESS" | "ON_HOLD" | "COMPLETED" | "CANCELLED";
export const workOrderMachine = defineMachine<
  WorkOrderStatus,
  "release" | "start" | "hold" | "resume" | "complete" | "cancel"
>("WorkOrder", [
  {
    action: "release",
    from: ["PLANNED"],
    to: "RELEASED",
    permission: "production.workorder.write",
  },
  {
    action: "start",
    from: ["RELEASED"],
    to: "IN_PROGRESS",
    permission: "production.operation.execute",
  },
  {
    action: "hold",
    from: ["RELEASED", "IN_PROGRESS"],
    to: "ON_HOLD",
    permission: "production.workorder.write",
  },
  {
    action: "resume",
    from: ["ON_HOLD"],
    to: "IN_PROGRESS",
    permission: "production.workorder.write",
  },
  {
    action: "complete",
    from: ["IN_PROGRESS"],
    to: "COMPLETED",
    permission: "production.operation.execute",
  },
  {
    action: "cancel",
    from: ["PLANNED", "RELEASED", "ON_HOLD"],
    to: "CANCELLED",
    permission: "production.workorder.write",
  },
]);
