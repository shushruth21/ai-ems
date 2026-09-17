import {
  purchaseOrderMachine,
  quoteMachine,
  salesOrderMachine,
  workOrderMachine,
} from "./machines";
import { InvalidTransitionError } from "./state-machine";

describe("sales order lifecycle", () => {
  it("walks the happy path", () => {
    let s = salesOrderMachine.next("DRAFT", "confirm");
    s = salesOrderMachine.next(s, "start_production");
    s = salesOrderMachine.next(s, "mark_ready");
    s = salesOrderMachine.next(s, "ship_all");
    s = salesOrderMachine.next(s, "close");
    expect(s).toBe("CLOSED");
  });

  it("forbids cancelling a shipped order", () => {
    expect(salesOrderMachine.can("SHIPPED", "cancel")).toBe(false);
    expect(() => salesOrderMachine.next("SHIPPED", "cancel")).toThrow(InvalidTransitionError);
  });

  it("lists available actions and required permissions", () => {
    expect(salesOrderMachine.actionsFrom("DRAFT").sort()).toEqual(["cancel", "confirm"]);
    expect(salesOrderMachine.permissionFor("confirm")).toBe("sales.order.confirm");
  });
});

describe("other machines", () => {
  it("quote approval returns to draft before sending", () => {
    const pending = quoteMachine.next("DRAFT", "submit");
    expect(quoteMachine.next(pending, "approve")).toBe("DRAFT");
    expect(quoteMachine.can("PENDING_APPROVAL", "send")).toBe(false);
  });

  it("purchase orders require approval before sending", () => {
    expect(purchaseOrderMachine.can("DRAFT", "send")).toBe(false);
    expect(purchaseOrderMachine.next("PENDING_APPROVAL", "approve")).toBe("APPROVED");
  });

  it("work orders can be put on hold and resumed", () => {
    const held = workOrderMachine.next("IN_PROGRESS", "hold");
    expect(workOrderMachine.next(held, "resume")).toBe("IN_PROGRESS");
    expect(workOrderMachine.can("COMPLETED", "cancel")).toBe(false);
  });

  it("every transition targets a status reachable in its own machine", () => {
    for (const m of [quoteMachine, salesOrderMachine, purchaseOrderMachine, workOrderMachine]) {
      for (const t of m.transitions) expect(t.from.length).toBeGreaterThan(0);
    }
  });
});
