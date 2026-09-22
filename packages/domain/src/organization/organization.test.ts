import { invitationExpiry, invitationMatchesEmail, invitationState } from "./invitation";
import {
  canChangeRole,
  canInviteWithRole,
  canLeave,
  canReactivate,
  canRemove,
  canSuspend,
  type MemberFacts,
} from "./membership-policy";
import { checkSlug, slugCandidates, slugify } from "./slug";

const m = (
  profileId: string,
  roleKey: string,
  status: MemberFacts["status"] = "ACTIVE",
): MemberFacts => ({
  profileId,
  roleKey,
  status,
});

describe("slugs", () => {
  it("slugifies names", () => {
    expect(slugify("Acme Studio (NYC)")).toBe("acme-studio-nyc");
    expect(slugify("  Café Möbel & Co.  ")).toBe("cafe-mobel-and-co");
    expect(slugify("---")).toBe("");
    expect(slugify("x".repeat(60))).toHaveLength(40);
  });

  it("validates", () => {
    expect(checkSlug("acme")).toBeNull();
    expect(checkSlug("ab")).toBe("too_short");
    expect(checkSlug("a".repeat(41))).toBe("too_long");
    expect(checkSlug("Acme")).toBe("invalid");
    expect(checkSlug("-acme")).toBe("invalid");
    expect(checkSlug("ac--me")).toBe("invalid");
    expect(checkSlug("login")).toBe("reserved");
    expect(checkSlug("preview")).toBe("reserved");
  });

  it("suggests alternatives within the length limit", () => {
    expect(slugCandidates("acme", 2)).toEqual(["acme-2", "acme-3"]);
    expect(slugCandidates("a".repeat(40), 1)[0]).toHaveLength(40);
  });
});

describe("membership policy", () => {
  const owner = m("o1", "owner");
  const admin = m("a1", "admin");
  const rep = m("r1", "sales_rep");

  it("forbids acting on yourself", () => {
    expect(canChangeRole({ actor: admin, target: admin, activeOwnerCount: 1 }, "viewer")).toEqual({
      ok: false,
      reason: "not_self",
    });
  });

  it("reserves the owner role for owners", () => {
    expect(canChangeRole({ actor: admin, target: rep, activeOwnerCount: 1 }, "owner").ok).toBe(
      false,
    );
    expect(canChangeRole({ actor: admin, target: owner, activeOwnerCount: 2 }, "admin").ok).toBe(
      false,
    );
    expect(canChangeRole({ actor: owner, target: rep, activeOwnerCount: 1 }, "owner").ok).toBe(
      true,
    );
    expect(canChangeRole({ actor: admin, target: rep, activeOwnerCount: 1 }, "buyer").ok).toBe(
      true,
    );
    expect(canInviteWithRole(admin, "owner").ok).toBe(false);
    expect(canInviteWithRole(owner, "owner").ok).toBe(true);
  });

  it("keeps at least one active owner", () => {
    const other = m("o2", "owner");
    expect(canChangeRole({ actor: other, target: owner, activeOwnerCount: 1 }, "admin")).toEqual({
      ok: false,
      reason: "last_owner",
    });
    expect(canChangeRole({ actor: other, target: owner, activeOwnerCount: 2 }, "admin").ok).toBe(
      true,
    );
    expect(canSuspend({ actor: other, target: owner, activeOwnerCount: 1 }).ok).toBe(false);
    expect(canRemove({ actor: other, target: owner, activeOwnerCount: 1 }).ok).toBe(false);
    expect(canLeave({ target: owner, activeOwnerCount: 1 }).ok).toBe(false);
    expect(canLeave({ target: owner, activeOwnerCount: 2 }).ok).toBe(true);
    expect(canLeave({ target: rep, activeOwnerCount: 1 }).ok).toBe(true);
  });

  it("checks status transitions", () => {
    expect(
      canSuspend({ actor: admin, target: m("r2", "viewer", "SUSPENDED"), activeOwnerCount: 1 }).ok,
    ).toBe(false);
    expect(
      canReactivate({ actor: admin, target: m("r2", "viewer", "SUSPENDED"), activeOwnerCount: 1 })
        .ok,
    ).toBe(true);
    expect(canReactivate({ actor: admin, target: rep, activeOwnerCount: 1 }).ok).toBe(false);
  });
});

describe("invitations", () => {
  const now = new Date("2026-09-22T12:00:00Z");
  it("derives state", () => {
    const base = { expiresAt: invitationExpiry(now), acceptedAt: null, revokedAt: null };
    expect(invitationState(base, now)).toBe("pending");
    expect(invitationState({ ...base, acceptedAt: now }, now)).toBe("accepted");
    expect(invitationState({ ...base, revokedAt: now }, now)).toBe("revoked");
    expect(invitationState(base, new Date("2026-09-29T12:00:00Z"))).toBe("expired");
  });

  it("binds to the invited address", () => {
    expect(invitationMatchesEmail("Ada@Example.com ", "ada@example.com")).toBe(true);
    expect(invitationMatchesEmail("ada@example.com", "eve@example.com")).toBe(false);
    expect(invitationMatchesEmail("ada@example.com", null)).toBe(false);
  });
});
