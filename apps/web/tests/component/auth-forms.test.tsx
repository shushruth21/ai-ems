// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ChangePasswordForm } from "@/features/auth/components/change-password-form";
import { ConfirmLinkForm } from "@/features/auth/components/confirm-link-form";
import { MfaSettings } from "@/features/auth/components/mfa-settings";
import { PasswordStrength } from "@/features/auth/components/password-strength";
import { SignInForm } from "@/features/auth/components/sign-in-form";
import { SignUpForm } from "@/features/auth/components/sign-up-form";

const actions = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  requestMagicLink: vi.fn(),
  signUp: vi.fn(),
  changePassword: vi.fn(),
  confirmEmailLink: vi.fn(),
  startTotpEnrollment: vi.fn(),
  confirmTotpEnrollment: vi.fn(),
  cancelTotpEnrollment: vi.fn(),
  removeTotpFactor: vi.fn(),
}));
vi.mock("@/features/auth/actions", () => actions);

beforeEach(() => {
  Object.values(actions).forEach((fn) => fn.mockReset());
});

describe("SignInForm", () => {
  it("validates before calling the server", async () => {
    const user = userEvent.setup();
    render(<SignInForm magicLinkEnabled />);
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Enter your email address")).toBeInTheDocument();
    expect(screen.getByText("Enter your password")).toBeInTheDocument();
    expect(actions.signInWithPassword).not.toHaveBeenCalled();
  });

  it("sends normalized input and shows the server's safe error", async () => {
    actions.signInWithPassword.mockResolvedValue({
      ok: false,
      formError: "Email or password is incorrect.",
    });
    const user = userEvent.setup();
    render(<SignInForm magicLinkEnabled next="/crm" />);
    await user.type(screen.getByRole("textbox", { name: "Email" }), "  Ada@Example.com ");
    await user.type(screen.getByLabelText("Password", { selector: "input" }), "hunter2hunter2");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Email or password is incorrect.");
    expect(actions.signInWithPassword).toHaveBeenCalledWith({
      email: "ada@example.com",
      password: "hunter2hunter2",
      next: "/crm",
    });
  });

  it("maps field errors from the server onto fields", async () => {
    actions.signInWithPassword.mockResolvedValue({
      ok: false,
      fieldErrors: { password: "Too many characters" },
    });
    const user = userEvent.setup();
    render(<SignInForm magicLinkEnabled={false} />);
    await user.type(screen.getByRole("textbox", { name: "Email" }), "a@example.com");
    await user.type(screen.getByLabelText("Password", { selector: "input" }), "x");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Too many characters")).toBeInTheDocument();
    expect(screen.getByLabelText("Password", { selector: "input" })).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
  });

  it("requests a magic link and shows the generic confirmation", async () => {
    actions.requestMagicLink.mockResolvedValue({ ok: true, message: "If an account exists…" });
    const user = userEvent.setup();
    render(<SignInForm magicLinkEnabled />);
    await user.click(screen.getByRole("tab", { name: "With email link" }));
    await user.type(await screen.findByRole("textbox", { name: "Email" }), "a@example.com");
    await user.click(screen.getByRole("button", { name: "Email me a sign-in link" }));
    expect(await screen.findByRole("status")).toHaveTextContent("If an account exists…");
  });

  it("toggles password visibility", async () => {
    const user = userEvent.setup();
    render(<SignInForm magicLinkEnabled={false} />);
    const input = screen.getByLabelText("Password", { selector: "input" });
    expect(input).toHaveAttribute("type", "password");
    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(input).toHaveAttribute("type", "text");
  });
});

describe("SignUpForm", () => {
  it("enforces the password policy and terms client-side", async () => {
    const user = userEvent.setup();
    render(<SignUpForm />);
    await user.type(screen.getByRole("textbox", { name: "Full name" }), "Ada Lovelace");
    await user.type(screen.getByRole("textbox", { name: "Work email" }), "ada@example.com");
    await user.type(screen.getByLabelText("Password", { selector: "input" }), "lovelace1234");
    await user.click(screen.getByRole("button", { name: "Create account" }));
    // Shown by the live meter and as the field error.
    expect(await screen.findAllByText(/include your name or email/i)).toHaveLength(2);
    expect(screen.getByLabelText("Password", { selector: "input" })).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByText("You must accept the terms to continue")).toBeInTheDocument();
    expect(actions.signUp).not.toHaveBeenCalled();
  });
});

describe("PasswordStrength", () => {
  it("shows guidance, then a live label", () => {
    const { rerender } = render(<PasswordStrength password="" />);
    expect(screen.getByText(/at least 12 characters/)).toBeInTheDocument();
    rerender(<PasswordStrength password="Quiet-River-Lantern-42" />);
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    expect(screen.getByText("Strong")).toBeInTheDocument();
  });
});

describe("ChangePasswordForm", () => {
  it("requires matching new passwords", async () => {
    const user = userEvent.setup();
    render(<ChangePasswordForm email="ada@example.com" hasPassword />);
    await user.type(screen.getByLabelText("Current password"), "old password");
    await user.type(screen.getByLabelText("New password"), "Quiet-River-Lantern-42");
    await user.type(screen.getByLabelText("Confirm new password"), "Quiet-River-Lantern-43");
    await user.click(screen.getByRole("button", { name: "Update password" }));
    expect(await screen.findByText("Passwords don't match")).toBeInTheDocument();
    expect(actions.changePassword).not.toHaveBeenCalled();
  });

  it("explains how to add a password for passwordless accounts", () => {
    render(<ChangePasswordForm email="ada@example.com" hasPassword={false} />);
    expect(screen.getByRole("link", { name: "reset password" })).toHaveAttribute(
      "href",
      "/forgot-password",
    );
  });
});

describe("ConfirmLinkForm", () => {
  it("only verifies on an explicit click and reports failures", async () => {
    actions.confirmEmailLink.mockResolvedValue({
      ok: false,
      formError: "This link is invalid or has expired.",
    });
    const user = userEvent.setup();
    render(<ConfirmLinkForm tokenHash={"a".repeat(56)} type="recovery" />);
    expect(actions.confirmEmailLink).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Continue to reset your password" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("invalid or has expired");
  });
});

describe("MfaSettings", () => {
  it("walks through TOTP enrollment", async () => {
    actions.startTotpEnrollment.mockResolvedValue({
      ok: true,
      data: {
        factorId: "f1",
        qrCode: "data:image/svg+xml;utf-8,<svg/>",
        secret: "JBSWY3DPEHPK3PXP",
        uri: "otpauth://x",
      },
    });
    actions.confirmTotpEnrollment.mockResolvedValue({
      ok: true,
      message: "Two-factor authentication is on.",
    });
    const user = userEvent.setup();
    render(<MfaSettings factors={[]} canRemove={false} />);
    await user.click(screen.getByRole("button", { name: "Set up authenticator app" }));
    expect(await screen.findByRole("img", { name: /QR code/ })).toBeInTheDocument();
    expect(screen.getByTestId("totp-secret")).toHaveTextContent("JBSWY3DPEHPK3PXP");

    await user.type(screen.getByRole("textbox", { name: /6-digit code/ }), "123 456");
    await user.click(screen.getByRole("button", { name: "Turn on" }));
    await waitFor(() =>
      expect(actions.confirmTotpEnrollment).toHaveBeenCalledWith({
        factorId: "f1",
        code: "123456",
      }),
    );
    expect(await screen.findByText("Two-factor authentication is on.")).toBeInTheDocument();
  });

  it("disables removal until the session has passed MFA", () => {
    render(
      <MfaSettings
        factors={[{ id: "f1", name: "Phone", createdAt: "2026-01-01T00:00:00Z" }]}
        canRemove={false}
      />,
    );
    expect(screen.getByRole("button", { name: "Remove" })).toBeDisabled();
  });
});
