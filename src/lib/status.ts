import type { BadgeTone } from "@/components/ui/badge";

/**
 * Maps workflow status codes (from the Prisma enums) to a display label and a
 * semantic tone. One table for the whole app keeps status colors consistent.
 */
const TONES: Record<string, BadgeTone> = {
  // neutral / not started
  DRAFT: "neutral",
  NEW: "neutral",
  PLANNED: "neutral",
  PENDING: "neutral",
  TODO: "neutral",
  // waiting on someone
  PENDING_APPROVAL: "warning",
  ON_HOLD: "warning",
  PAUSED: "warning",
  BLOCKED: "warning",
  CONDITIONAL: "warning",
  PARTIALLY_RECEIVED: "warning",
  PARTIALLY_SHIPPED: "warning",
  PARTIALLY_PAID: "warning",
  PARTIALLY_ACCEPTED: "warning",
  INSPECTING: "warning",
  REWORK: "warning",
  // active
  CONTACTED: "info",
  QUALIFIED: "info",
  PROPOSAL: "info",
  SENT: "info",
  APPROVED: "info",
  CONFIRMED: "info",
  RELEASED: "info",
  READY: "info",
  IN_PROGRESS: "info",
  IN_PRODUCTION: "info",
  IN_TRANSIT: "info",
  SCHEDULED: "info",
  PACKED: "info",
  ISSUED: "info",
  IN_REVIEW: "info",
  // done
  WON: "success",
  ACCEPTED: "success",
  RECEIVED: "success",
  COMPLETED: "success",
  SHIPPED: "success",
  DELIVERED: "success",
  PASSED: "success",
  PAID: "success",
  DONE: "success",
  CLOSED: "success",
  ACTIVE: "success",
  // negative
  LOST: "danger",
  REJECTED: "danger",
  CANCELLED: "danger",
  FAILED: "danger",
  EXPIRED: "danger",
  VOID: "danger",
  DISQUALIFIED: "danger",
  DISCONTINUED: "danger",
  OBSOLETE: "neutral",
  ARCHIVED: "neutral",
};

const LABEL_OVERRIDES: Record<string, string> = {
  PENDING_APPROVAL: "Pending approval",
  IN_PRODUCTION: "In production",
  NEW: "New",
};

export function statusTone(status: string): BadgeTone {
  return TONES[status.toUpperCase()] ?? "neutral";
}

/** "PARTIALLY_SHIPPED" → "Partially shipped" */
export function statusLabel(status: string): string {
  const key = status.toUpperCase();
  if (LABEL_OVERRIDES[key]) return LABEL_OVERRIDES[key];
  const words = key.toLowerCase().split("_").filter(Boolean);
  if (!words.length) return status;
  return words.join(" ").replace(/^./, (c) => c.toUpperCase());
}
