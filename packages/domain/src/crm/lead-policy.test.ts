import {
  canAssignLead,
  canEditLead,
  canTransition,
  followUpAgeDays,
  isClosed,
  leadMachine,
  type LeadAction,
  type LeadFacts,
  type LeadStatus,
} from "./lead-policy";

const lead = (over: Partial<LeadFacts> = {}): LeadFacts => ({
  status: "NEW",
  ownerId: "owner-1",
  hasContact: true,
  estimatedValue: 5000,
  ...over,
});

const rep = { profileId: "owner-1", canAssign: false };
const otherRep = { profileId: "owner-2", canAssign: false };
const manager = { profileId: "manager", canAssign: true };

describe("lead lifecycle", () => {
  it("offers only the steps that make sense from each status", () => {
    expect(leadMachine.actionsFrom("NEW").sort()).toEqual([
      "contact",
      "disqualify",
      "lose",
      "qualify",
    ]);
    expect(leadMachine.actionsFrom("WON")).toEqual([]);
    expect(leadMachine.actionsFrom("LOST")).toEqual(["reopen"]);
    expect(leadMachine.next("QUALIFIED", "win")).toBe("WON");
  });

  it("knows which statuses are closed", () => {
    const closed: LeadStatus[] = ["WON", "LOST", "DISQUALIFIED"];
    for (const status of ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL"] as LeadStatus[]) {
      expect(isClosed(status)).toBe(false);
    }
    for (const status of closed) expect(isClosed(status)).toBe(true);
  });

  it("never leaves a status with no way back", () => {
    // Every status except WON can move somewhere; WON is deliberately final.
    const statuses: LeadStatus[] = [
      "NEW",
      "CONTACTED",
      "QUALIFIED",
      "PROPOSAL",
      "LOST",
      "DISQUALIFIED",
    ];
    for (const status of statuses)
      expect(leadMachine.actionsFrom(status).length).toBeGreaterThan(0);
  });
});

describe("who may work on a lead", () => {
  it("keeps reps out of other people's leads", () => {
    expect(canEditLead(lead(), rep)).toEqual({ ok: true });
    expect(canEditLead(lead(), otherRep)).toEqual({ ok: false, reason: "not_owner" });
    expect(canEditLead(lead(), manager)).toEqual({ ok: true });
    // An unassigned lead is anyone's to pick up.
    expect(canEditLead(lead({ ownerId: null }), otherRep)).toEqual({ ok: true });
  });

  it("only lets people with the permission reassign", () => {
    expect(canAssignLead(manager)).toEqual({ ok: true });
    expect(canAssignLead(rep)).toEqual({ ok: false, reason: "not_owner" });
  });
});

describe("transition rules", () => {
  it("requires a reason before closing as lost or disqualified", () => {
    expect(canTransition(lead(), rep, "lose")).toEqual({ ok: false, reason: "reason_required" });
    expect(canTransition(lead(), rep, "lose", { reason: "  " })).toEqual({
      ok: false,
      reason: "reason_required",
    });
    expect(canTransition(lead(), rep, "lose", { reason: "Bought elsewhere" })).toEqual({
      ok: true,
    });
  });

  it("wants a contact before qualifying and a value before proposing", () => {
    expect(canTransition(lead({ hasContact: false }), rep, "qualify")).toEqual({
      ok: false,
      reason: "needs_contact",
    });
    expect(
      canTransition(lead({ status: "QUALIFIED", estimatedValue: null }), rep, "propose"),
    ).toEqual({ ok: false, reason: "needs_value" });
    expect(canTransition(lead({ status: "QUALIFIED", estimatedValue: 0 }), rep, "propose")).toEqual(
      { ok: false, reason: "needs_value" },
    );
    expect(canTransition(lead({ status: "QUALIFIED" }), rep, "propose")).toEqual({ ok: true });
  });

  it("explains a closed lead differently from a nonsense step", () => {
    expect(canTransition(lead({ status: "WON" }), rep, "contact")).toEqual({
      ok: false,
      reason: "closed",
    });
    expect(canTransition(lead({ status: "NEW" }), rep, "propose")).toEqual({
      ok: false,
      reason: "invalid_transition",
    });
    expect(canTransition(lead({ status: "LOST" }), rep, "reopen")).toEqual({ ok: true });
  });

  it("checks ownership before anything else", () => {
    const actions: LeadAction[] = ["contact", "qualify", "win", "reopen"];
    for (const action of actions) {
      expect(canTransition(lead(), otherRep, action)).toEqual({
        ok: false,
        reason: "not_owner",
      });
    }
  });
});

describe("follow-up age", () => {
  const now = new Date("2026-09-22T12:00:00Z");
  it("counts whole days, negative when still ahead", () => {
    expect(followUpAgeDays(null, now)).toBeNull();
    expect(followUpAgeDays(new Date("2026-09-20T12:00:00Z"), now)).toBe(2);
    expect(followUpAgeDays(new Date("2026-09-24T12:00:00Z"), now)).toBe(-2);
  });
});
