import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import {
  confirmLinkFor,
  createUser,
  currentCode,
  isolateClientIp,
  latestEmail,
  passMfa,
  PASSWORD,
  signIn,
  uniqueEmail,
} from "./support/auth";

async function expectNoSeriousA11y(page: Page) {
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .filter((a) => a.effect?.getTiming().iterations !== Infinity)
      .every((a) => a.playState !== "running"),
  );
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  const serious = results.violations.filter((v) =>
    ["serious", "critical"].includes(v.impact ?? ""),
  );
  expect(
    serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`),
  ).toEqual([]);
}

async function signOutViaAccount(page: Page) {
  await page.goto("/account");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/login\?notice=signed-out$/);
}

/** Form-level feedback (Next's route announcer also has role="alert"). */
const formAlert = (page: Page) => page.locator('[data-slot="alert"]');

test.beforeEach(async ({ page }) => {
  await isolateClientIp(page);
});

test.describe("auth pages", () => {
  for (const path of ["/login", "/signup", "/forgot-password", "/verify-email", "/auth/confirm"]) {
    test(`${path} is accessible in light and dark`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expectNoSeriousA11y(page);
      await page.emulateMedia({ colorScheme: "dark" });
      await page.reload();
      await expectNoSeriousA11y(page);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }

  test("private pages send anonymous visitors to sign in and back", async ({ page }) => {
    const email = uniqueEmail("redirect");
    await createUser(email);
    await page.goto("/account?notice=password-updated");
    await expect(page).toHaveURL(/\/login\?next=%2Faccount%3Fnotice%3Dpassword-updated$/);
    await page.getByRole("textbox", { name: "Email" }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/account\?notice=password-updated$/);
    await expect(page.getByText("Your password was updated.")).toBeVisible();
  });

  test("ignores off-site redirect targets", async ({ page }) => {
    const email = uniqueEmail("openredirect");
    await createUser(email);
    await signIn(page, email, PASSWORD, "https://evil.example/phish");
    await expect(page).toHaveURL(/\/onboarding$/);
  });
});

test.describe("password sign-in", () => {
  test("rejects bad credentials without revealing whether the account exists", async ({ page }) => {
    const email = uniqueEmail("badpw");
    await createUser(email);
    await signIn(page, email, "wrong-password-123");
    await expect(formAlert(page)).toHaveText("Email or password is incorrect.");
    await signIn(page, uniqueEmail("nobody"), "wrong-password-123");
    await expect(formAlert(page)).toHaveText("Email or password is incorrect.");
  });

  test("signs in, shows the account, keeps signed-in users off /login, signs out", async ({
    page,
  }) => {
    const email = uniqueEmail("signin");
    await createUser(email, { fullName: "Grace Hopper" });
    await signIn(page, email);
    await expect(page).toHaveURL(/\/onboarding$/);
    await page.goto("/account");
    await expect(page.getByTestId("account-name")).toHaveText("Grace Hopper");
    await expect(page.getByTestId("account-email")).toHaveText(email);
    await expect(page.getByRole("list", { name: "Recent security activity" })).toContainText(
      "Signed in",
    );
    await expectNoSeriousA11y(page);

    await page.goto("/login");
    await expect(page).toHaveURL(/\/onboarding$/);

    await signOutViaAccount(page);
    await expect(page.getByText("You've been signed out.")).toBeVisible();
    await page.goto("/account");
    await expect(page).toHaveURL(/\/login/);
  });

  test("rate-limits repeated failures for one account", async ({ page }) => {
    const email = uniqueEmail("ratelimit");
    await createUser(email);
    for (let i = 0; i < 10; i++) {
      await signIn(page, email, `wrong-password-${i}`);
      await expect(formAlert(page)).toHaveText("Email or password is incorrect.");
    }
    // Even the right password is refused while the limit is active.
    await signIn(page, email, PASSWORD);
    await expect(formAlert(page)).toHaveText(/Too many attempts/);
  });
});

test.describe("sign-up and email links", () => {
  test("sign up → confirm email → account", async ({ page }) => {
    const email = uniqueEmail("signup");
    await page.goto("/signup");
    await page.getByRole("textbox", { name: "Full name" }).fill("Katherine Johnson");
    await page.getByRole("textbox", { name: "Work email" }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await expect(page.getByTestId("password-strength")).toContainText("Strong");
    await page.getByRole("checkbox", { name: /I agree/ }).check();
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/verify-email$/);

    // Password sign-in is refused until the address is confirmed.
    await signIn(page, email);
    await expect(formAlert(page)).toContainText("Confirm your email address first");

    const mail = await latestEmail(email, "signup");
    await page.goto(confirmLinkFor(mail));
    await page.getByRole("button", { name: /Confirm email/ }).click();
    await expect(page).toHaveURL(/\/onboarding$/);
    await page.goto("/account");
    await expect(page.getByTestId("account-name")).toHaveText("Katherine Johnson");

    // Links are single-use.
    await signOutViaAccount(page);
    await page.goto(confirmLinkFor(mail));
    await page.getByRole("button", { name: /Confirm email/ }).click();
    await expect(formAlert(page)).toContainText("invalid or has expired");
  });

  test("signing up with a taken email looks identical", async ({ page }) => {
    const email = uniqueEmail("taken");
    await createUser(email);
    await page.goto("/signup");
    await page.getByRole("textbox", { name: "Full name" }).fill("Someone Else");
    await page.getByRole("textbox", { name: "Work email" }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByRole("checkbox", { name: /I agree/ }).check();
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/verify-email$/);
  });

  test("magic link signs in", async ({ page }) => {
    const email = uniqueEmail("magic");
    await createUser(email);
    await page.goto("/login");
    await page.getByRole("tab", { name: "With email link" }).click();
    await page.getByRole("textbox", { name: "Email" }).fill(email);
    await page.getByRole("button", { name: "Email me a sign-in link" }).click();
    await expect(formAlert(page)).toContainText("If an account exists");

    const mail = await latestEmail(email, "magiclink");
    await page.goto(confirmLinkFor(mail));
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/onboarding$/);
  });

  test("broken links explain what to do", async ({ page }) => {
    await page.goto("/auth/confirm?token_hash=%3Cx%3E&type=recovery");
    await expect(page.getByRole("heading", { name: "This link doesn't work" })).toBeVisible();
  });
});

test.describe("password reset and change", () => {
  test("forgot password → email → new password → old one stops working", async ({ page }) => {
    const email = uniqueEmail("reset");
    await createUser(email);
    await page.goto("/forgot-password");
    await page.getByRole("textbox", { name: "Email" }).fill(email);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(formAlert(page)).toContainText("If an account exists");

    const mail = await latestEmail(email, "recovery");
    await page.goto(confirmLinkFor(mail));
    await page.getByRole("button", { name: "Continue to reset your password" }).click();
    await expect(page).toHaveURL(/\/reset-password$/);
    await page.getByLabel("New password", { exact: true }).fill("Silver-Maple-Harbor-77");
    await page.getByLabel("Confirm new password").fill("Silver-Maple-Harbor-77");
    await page.getByRole("button", { name: "Update password" }).click();
    await expect(page).toHaveURL(/\/account\?notice=password-updated$/);

    await signOutViaAccount(page);
    await signIn(page, email, PASSWORD);
    await expect(formAlert(page)).toHaveText("Email or password is incorrect.");
    await signIn(page, email, "Silver-Maple-Harbor-77");
    await expect(page).toHaveURL(/\/onboarding$/);
  });

  test("change password requires the current one", async ({ page }) => {
    const email = uniqueEmail("change");
    await createUser(email);
    await signIn(page, email);
    await expect(page).toHaveURL(/\/onboarding$/);
    await page.goto("/account");
    const form = page.getByRole("form", { name: "Change password" });
    await form.getByLabel("Current password").fill("not-my-password");
    await form.getByLabel("New password", { exact: true }).fill("Copper-Field-Orbit-19");
    await form.getByLabel("Confirm new password").fill("Copper-Field-Orbit-19");
    await form.getByRole("button", { name: "Update password" }).click();
    await expect(form.getByText("Your current password is incorrect.")).toBeVisible();

    await form.getByLabel("Current password").fill(PASSWORD);
    await form.getByRole("button", { name: "Update password" }).click();
    await expect(form.locator('[data-slot="alert"]')).toContainText("Password updated");
  });
});

test.describe("two-factor authentication", () => {
  test("enroll → sign in again → challenge → disable", async ({ page }) => {
    const email = uniqueEmail("mfa");
    await createUser(email);
    await signIn(page, email);
    await expect(page).toHaveURL(/\/onboarding$/);
    await page.goto("/account");

    await page.getByRole("button", { name: "Set up authenticator app" }).click();
    const enrollment = page.getByTestId("totp-enrollment");
    await expect(enrollment.getByRole("img", { name: /QR code/ })).toBeVisible();
    const secret = (await enrollment.getByTestId("totp-secret").textContent())!.trim();
    await enrollment.getByRole("textbox", { name: /6-digit code/ }).fill("000000");
    await enrollment.getByRole("button", { name: "Turn on" }).click();
    await expect(enrollment.getByText("That code didn't work")).toBeVisible();
    await enrollment.getByRole("textbox", { name: /6-digit code/ }).fill(currentCode(secret));
    await enrollment.getByRole("button", { name: "Turn on" }).click();
    await expect(page.getByText("Two-factor authentication is on.")).toBeVisible();
    await expect(page.getByRole("list", { name: "Recent security activity" })).toContainText(
      "Two-factor authentication turned on",
    );

    await signOutViaAccount(page);
    await signIn(page, email, PASSWORD, "/account?from=mfa");
    await expect(page).toHaveURL(/\/login\/mfa\?next=%2Faccount%3Ffrom%3Dmfa$/);
    await expectNoSeriousA11y(page);

    // The session is not usable until the challenge is passed.
    await page.goto("/account");
    await expect(page).toHaveURL(/\/login\/mfa/);
    await page.goto("/login?next=%2Faccount%3Ffrom%3Dmfa");
    await expect(page).toHaveURL(/\/login\/mfa\?next=%2Faccount%3Ffrom%3Dmfa$/);

    await page.getByRole("textbox", { name: "Authentication code" }).fill("123456");
    await page.getByRole("button", { name: "Verify" }).click();
    await expect(page.getByText("That code didn't work")).toBeVisible();
    await passMfa(page, secret);
    await expect(page).toHaveURL(/\/account\?from=mfa$/);

    await page.getByRole("button", { name: "Remove" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Turn off" }).click();
    await expect(page.getByText("Two-factor authentication is off.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Set up authenticator app" })).toBeVisible();
  });

  test("an MFA account can abandon the challenge and switch accounts", async ({ page }) => {
    const email = uniqueEmail("mfaswitch");
    const { id } = await createUser(email, { totp: true });
    expect(id).toBeTruthy();
    await signIn(page, email);
    await expect(page).toHaveURL(/\/login\/mfa$/);
    await page.getByRole("button", { name: "Use a different account" }).click();
    await expect(page).toHaveURL(/\/login\?notice=signed-out$/);
  });

  test("seeded authenticator passes the challenge", async ({ page }) => {
    const email = uniqueEmail("mfaseed");
    const { totpSecret } = await createUser(email, { totp: true });
    await signIn(page, email);
    await passMfa(page, totpSecret!);
    await expect(page).toHaveURL(/\/onboarding$/);
    await page.goto("/account");
    await expect(page.getByRole("button", { name: "Remove" })).toBeEnabled();
  });
});

test.describe("sessions and OAuth", () => {
  test("sign out of all devices ends other sessions", async ({ browser, page }) => {
    const email = uniqueEmail("global");
    await createUser(email);
    await signIn(page, email);
    await expect(page).toHaveURL(/\/onboarding$/);
    await page.goto("/account");

    const other = await browser.newContext();
    const otherPage = await other.newPage();
    await isolateClientIp(otherPage);
    await signIn(otherPage, email);
    await expect(otherPage).toHaveURL(/\/onboarding$/);

    await page.getByRole("button", { name: "Sign out of all devices" }).click();
    await expect(page).toHaveURL(/\/login\?notice=signed-out$/);

    await otherPage.goto("/account");
    await expect(otherPage).toHaveURL(/\/login\?next=%2Faccount&error=session_expired$/);
    await expect(otherPage.getByText("Your session ended.")).toBeVisible();
    // Cookies were cleared, so the sign-in page is usable again.
    await signIn(otherPage, email);
    await expect(otherPage).toHaveURL(/\/onboarding$/);
    await other.close();
  });

  test("OAuth (PKCE) round-trip", async ({ page }) => {
    await page.goto("/login?next=%2Faccount%3Fvia%3Doauth");
    await page.getByRole("button", { name: "Continue with Google" }).click();
    await expect(page).toHaveURL(/\/account\?via=oauth$/);
    await expect(page.getByTestId("account-email")).toHaveText("google.user@example.test");
    // Connected-account users have no password to change here.
    await expect(page.getByRole("link", { name: "reset password" })).toBeVisible();
  });

  test("OAuth callback rejects bad codes", async ({ page }) => {
    await page.goto("/auth/callback?code=forged");
    await expect(page).toHaveURL(/\/login\?error=link_invalid$/);
    await expect(formAlert(page)).toContainText("invalid or has expired");
  });
});
