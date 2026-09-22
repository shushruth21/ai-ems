// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { CreateOrganizationForm } from "@/features/organizations/components/create-organization-form";
import { MembersManager } from "@/features/organizations/components/members-manager";
import { SecuritySettings } from "@/features/organizations/components/security-settings";

const actions = vi.hoisted(() => ({
  createOrganization: vi.fn(),
  checkSlugAvailability: vi.fn(),
  updateOrganization: vi.fn(),
  updateSecurityPolicy: vi.fn(),
  inviteMember: vi.fn(),
  resendInvitation: vi.fn(),
  revokeInvitation: vi.fn(),
  changeMemberRole: vi.fn(),
  suspendMember: vi.fn(),
  reactivateMember: vi.fn(),
  removeMember: vi.fn(),
  leaveOrganization: vi.fn(),
  acceptInvitation: vi.fn(),
}));
vi.mock("@/features/organizations/actions", () => actions);

const currencies = [
  { value: "USD", label: "USD — US Dollar" },
  { value: "EUR", label: "EUR — Euro" },
];

beforeEach(() => {
  // Default every action to a benign success so late-resolving calls from
  // unmounted components never blow up the run.
  Object.values(actions).forEach((fn) => {
    fn.mockReset();
    fn.mockResolvedValue({ ok: true });
  });
  actions.checkSlugAvailability.mockResolvedValue({ available: true });
});

describe("CreateOrganizationForm", () => {
  const setup = () =>
    render(
      <CreateOrganizationForm
        appOrigin="https://app.example"
        currencies={currencies}
        timeZones={["UTC", "Europe/Berlin"]}
      />,
    );

  it("suggests an address from the name and reports availability", async () => {
    const user = userEvent.setup();
    setup();
    await user.type(
      screen.getByRole("textbox", { name: "Company or team name" }),
      "Acme Studio & Co.",
    );
    expect(screen.getByRole("textbox", { name: "Workspace address" })).toHaveValue(
      "acme-studio-and-co",
    );
    expect(await screen.findByText("Available")).toBeInTheDocument();
    await waitFor(() =>
      expect(actions.checkSlugAvailability).toHaveBeenCalledWith("acme-studio-and-co"),
    );
  });

  it("shows a suggestion when the address is taken and stops submission", async () => {
    actions.checkSlugAvailability.mockResolvedValue({
      available: false,
      message: "That address is taken.",
      suggestion: "acme-2",
    });
    const user = userEvent.setup();
    setup();
    await user.type(screen.getByRole("textbox", { name: "Company or team name" }), "Acme");
    expect(await screen.findByText(/Try “acme-2”/)).toBeInTheDocument();
  });

  it("blocks reserved addresses client-side", async () => {
    const user = userEvent.setup();
    setup();
    await user.type(screen.getByRole("textbox", { name: "Company or team name" }), "Login");
    await user.click(screen.getByRole("button", { name: "Create workspace" }));
    expect(await screen.findByText(/reserved/)).toBeInTheDocument();
    expect(actions.createOrganization).not.toHaveBeenCalled();
  });

  it("submits the normalized values", async () => {
    const user = userEvent.setup();
    setup();
    await user.type(screen.getByRole("textbox", { name: "Company or team name" }), "Harbor Works");
    await user.selectOptions(screen.getByLabelText("Currency"), "EUR");
    await user.selectOptions(screen.getByLabelText("Time zone"), "Europe/Berlin");
    await user.click(screen.getByRole("button", { name: "Create workspace" }));
    await waitFor(() =>
      expect(actions.createOrganization).toHaveBeenCalledWith({
        name: "Harbor Works",
        slug: "harbor-works",
        currency: "EUR",
        timezone: "Europe/Berlin",
      }),
    );
  });
});

describe("MembersManager", () => {
  const members = [
    {
      id: "m1",
      name: "Olive Owner",
      email: "olive@example.test",
      roleKey: "owner",
      roleName: "Owner",
      status: "ACTIVE" as const,
      isSelf: true,
      joinedAt: "2026-01-01T00:00:00Z",
    },
    {
      id: "m2",
      name: null,
      email: "rep@example.test",
      roleKey: "sales_rep",
      roleName: "Sales Representative",
      status: "ACTIVE" as const,
      isSelf: false,
      joinedAt: "2026-02-01T00:00:00Z",
    },
  ];
  const roles = [
    { key: "owner", name: "Owner" },
    { key: "admin", name: "Administrator" },
    { key: "sales_rep", name: "Sales Representative" },
  ];

  const setup = (over: Partial<Parameters<typeof MembersManager>[0]> = {}) =>
    render(
      <MembersManager
        slug="acme"
        members={members}
        invitations={[]}
        roles={roles}
        canManage
        canAssignOwner={false}
        {...over}
      />,
    );

  it("never offers role changes or actions for your own membership", () => {
    setup();
    expect(screen.queryByLabelText("Role for olive@example.test")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Actions for olive@/ })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Role for rep@example.test")).toBeInTheDocument();
  });

  it("hides the owner role unless the actor is an owner", () => {
    setup();
    const select = screen.getByLabelText("Role for rep@example.test");
    expect(within(select).queryByRole("option", { name: "Owner" })).not.toBeInTheDocument();
    expect(within(select).getByRole("option", { name: "Administrator" })).toBeInTheDocument();
  });

  it("changes a role and reports the result", async () => {
    actions.changeMemberRole.mockResolvedValue({ ok: true, message: "Role updated." });
    const user = userEvent.setup();
    setup();
    await user.selectOptions(screen.getByLabelText("Role for rep@example.test"), "admin");
    await waitFor(() =>
      expect(actions.changeMemberRole).toHaveBeenCalledWith("acme", {
        membershipId: "m2",
        roleKey: "admin",
      }),
    );
    expect(await screen.findByText("Role updated.")).toBeInTheDocument();
  });

  it("surfaces the invitation link when email isn't configured", async () => {
    actions.inviteMember.mockResolvedValue({
      ok: true,
      data: {
        email: "new@example.test",
        roleName: "Read-only",
        link: "https://app.example/invite/abc",
        expiresAt: "2026-10-01T00:00:00Z",
        emailed: false,
      },
    });
    const user = userEvent.setup();
    setup();
    await user.type(screen.getByRole("textbox", { name: "Invite by email" }), "new@example.test");
    await user.click(screen.getByRole("button", { name: "Send invite" }));
    expect(await screen.findByTestId("invitation-link")).toHaveTextContent(
      "https://app.example/invite/abc",
    );
    expect(screen.getByText(/Email isn't configured/)).toBeInTheDocument();
  });

  it("read-only members see the roster but no controls", () => {
    setup({ canManage: false });
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.queryByRole("form", { name: "Invite a member" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Role for rep@example.test")).not.toBeInTheDocument();
  });
});

describe("SecuritySettings", () => {
  it("rolls the switch back when the server refuses", async () => {
    actions.updateSecurityPolicy.mockResolvedValue({
      ok: false,
      formError: "Set up two-factor authentication on your own account first.",
    });
    const user = userEvent.setup();
    render(<SecuritySettings slug="acme" requireMfa={false} disabled={false} />);
    const toggle = screen.getByLabelText("Require two-factor authentication");
    await user.click(toggle);
    expect(await screen.findByText(/Set up two-factor authentication/)).toBeInTheDocument();
    await waitFor(() => expect(toggle).not.toBeChecked());
  });
});
