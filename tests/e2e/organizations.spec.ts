import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";

import {
  createUser,
  createWorkspace,
  currentCode,
  isolateClientIp,
  signIn,
  uniqueEmail,
  uniqueWorkspaceName,
} from "./support/auth";

const formAlert = (page: Page) => page.locator('[data-slot="alert"]');

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

/** A signed-in browser context for a brand-new account. */
async function newMember(browser: Browser, tag: string) {
  const email = uniqueEmail(tag);
  await createUser(email, { fullName: `${tag} person` });
  const context = await browser.newContext();
  const page = await context.newPage();
  await isolateClientIp(page);
  await signIn(page, email);
  // Wait for the session cookie before the caller navigates anywhere.
  await expect(page).toHaveURL(/\/onboarding$/);
  return { email, page, context };
}

async function inviteTo(
  page: Page,
  slug: string,
  email: string,
  roleName: string,
): Promise<string> {
  await page.goto(`/${slug}/settings/members`);
  const form = page.getByRole("form", { name: "Invite a member" });
  await form.getByRole("textbox", { name: "Invite by email" }).fill(email);
  await form.getByLabel("Role", { exact: true }).selectOption({ label: roleName });
  await form.getByRole("button", { name: "Send invite" }).click();
  await expect(page.getByTestId("invitation-link")).toBeVisible();
  return (await page.getByTestId("invitation-link").textContent())!.trim();
}

test.beforeEach(async ({ page }) => {
  await isolateClientIp(page);
});

test.describe("onboarding", () => {
  test("a new account creates a workspace and lands in it", async ({ page, isMobile }) => {
    const email = uniqueEmail("founder");
    await createUser(email, { fullName: "Ada Founder" });
    await signIn(page, email);
    await expect(page).toHaveURL(/\/onboarding$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Welcome, Ada");
    await expectNoSeriousA11y(page);

    const name = uniqueWorkspaceName("Acme Furniture");
    const slug = await createWorkspace(page, name);
    await expect(formAlert(page)).toContainText("is ready");
    if (!isMobile) {
      await expect(page.getByRole("complementary", { name: "Sidebar" })).toContainText(name);
    }
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Welcome");
    await expectNoSeriousA11y(page);

    // Signed-in visits now resolve to the workspace, not onboarding.
    await page.goto("/login");
    await expect(page).toHaveURL(new RegExp(`/${slug}/dashboard$`));
    await page.goto("/onboarding");
    await expect(page).toHaveURL(new RegExp(`/${slug}/dashboard$`));
  });

  test("rejects reserved addresses and suggests a free one when taken", async ({
    page,
    browser,
  }) => {
    const first = await newMember(browser, "taken");
    const takenSlug = await createWorkspace(first.page, uniqueWorkspaceName("Harbor Works"));
    await first.context.close();

    const email = uniqueEmail("second");
    await createUser(email);
    await signIn(page, email);
    const address = page.getByRole("textbox", { name: "Workspace address" });
    await page.getByRole("textbox", { name: "Company or team name" }).fill("Login");
    await expect(page.getByText(/reserved/)).toBeVisible();
    await address.fill(takenSlug);
    await expect(page.getByText(new RegExp(`taken.*${takenSlug}-2`, "s"))).toBeVisible();
    await address.fill(`${takenSlug}-2`);
    await expect(page.getByText("Available")).toBeVisible();
  });
});

test.describe("invitations and members", () => {
  test("invite → accept → role change → suspend → remove", async ({ page, browser }) => {
    const ownerEmail = uniqueEmail("owner");
    await createUser(ownerEmail, { fullName: "Olive Owner" });
    await signIn(page, ownerEmail);
    const slug = await createWorkspace(page, uniqueWorkspaceName("Northwind"));

    const invitee = await newMember(browser, "rep");
    const link = await inviteTo(page, slug, invitee.email, "Sales Representative");
    await expect(page.getByRole("list", { name: "Pending invitations" })).toContainText(
      invitee.email,
    );

    // The invitee accepts from their own browser.
    await invitee.page.goto(new URL(link).pathname);
    await expect(invitee.page.getByRole("heading", { level: 1 })).toContainText("Join");
    await invitee.page.getByRole("button", { name: /Join / }).click();
    await expect(invitee.page).toHaveURL(new RegExp(`/${slug}/dashboard`));
    await expect(invitee.page.getByText("You've joined")).toBeVisible();
    // A sales rep may not manage members.
    await expect(invitee.page.getByRole("link", { name: "Members & roles" })).toHaveCount(0);
    await invitee.page.goto(`/${slug}/settings/members`);
    await expect(invitee.page.getByRole("form", { name: "Invite a member" })).toHaveCount(0);

    // The link is single use.
    await page.goto(new URL(link).pathname);
    await expect(page.getByText("already been used")).toBeVisible();

    await page.goto(`/${slug}/settings/members`);
    const row = page.getByRole("row", { name: new RegExp(invitee.email) });
    await expect(row).toContainText("active");
    await row.getByLabel(`Role for ${invitee.email}`).selectOption({ label: "Buyer" });
    await expect(formAlert(page)).toContainText("Role updated");

    await row.getByRole("button", { name: `Actions for ${invitee.email}` }).click();
    await page.getByRole("menuitem", { name: "Suspend access" }).click();
    await expect(formAlert(page)).toContainText("Member suspended");
    await invitee.page.goto(`/${slug}/dashboard`);
    await expect(invitee.page.getByRole("heading", { level: 1 })).toContainText(
      "We couldn't find that page",
    );

    await row.getByRole("button", { name: `Actions for ${invitee.email}` }).click();
    await page.getByRole("menuitem", { name: "Reactivate" }).click();
    await expect(formAlert(page)).toContainText("Member reactivated");

    await row.getByRole("button", { name: `Actions for ${invitee.email}` }).click();
    await page.getByRole("menuitem", { name: "Remove from workspace" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Remove" }).click();
    await expect(formAlert(page)).toContainText("Member removed");
    await expect(page.getByRole("row", { name: new RegExp(invitee.email) })).toHaveCount(0);
    await invitee.context.close();
  });

  test("an invitation only works for the address it was sent to", async ({ page, browser }) => {
    const ownerEmail = uniqueEmail("owner");
    await createUser(ownerEmail);
    await signIn(page, ownerEmail);
    const slug = await createWorkspace(page, uniqueWorkspaceName("Lakeside"));
    const link = await inviteTo(page, slug, uniqueEmail("intended"), "Read-only");

    const other = await newMember(browser, "other");
    await other.page.goto(new URL(link).pathname);
    await expect(other.page.getByRole("heading", { level: 1 })).toContainText("for someone else");
    await other.page.getByRole("button", { name: "Sign out" }).click();
    await expect(other.page).toHaveURL(/\/login/);
    await other.context.close();
  });

  test("protects the last owner and hides other workspaces", async ({ page, browser }) => {
    const ownerEmail = uniqueEmail("solo");
    await createUser(ownerEmail);
    await signIn(page, ownerEmail);
    const slug = await createWorkspace(page, uniqueWorkspaceName("Solo Works"));

    await page.goto(`/${slug}/settings/members`);
    // Owners can't change or remove their own membership from this screen.
    await expect(
      page.getByRole("button", { name: new RegExp(`Actions for ${ownerEmail}`) }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Leave workspace" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Leave" }).click();
    await expect(formAlert(page)).toContainText("at least one active owner");

    const stranger = await newMember(browser, "stranger");
    await stranger.page.goto(`/${slug}/dashboard`);
    await expect(stranger.page.getByRole("heading", { level: 1 })).toContainText(
      "We couldn't find that page",
    );
    await stranger.context.close();
  });
});

test.describe("workspace settings", () => {
  test("owners edit settings; the switcher and /app remember the last workspace", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "the workspace switcher lives in the desktop sidebar");
    const email = uniqueEmail("multi");
    await createUser(email, { fullName: "Mia Multi" });
    await signIn(page, email);
    const first = await createWorkspace(page, uniqueWorkspaceName("First Co"));

    await page.goto(`/${first}/settings`);
    const form = page.getByRole("form", { name: "Workspace settings" });
    await form.getByRole("textbox", { name: "Legal name" }).fill("First Co Limited");
    await form.getByLabel("Currency").selectOption("EUR");
    await form.getByRole("button", { name: "Save changes" }).click();
    await expect(formAlert(page)).toContainText("Settings saved");
    await page.reload();
    await expect(form.getByRole("textbox", { name: "Legal name" })).toHaveValue("First Co Limited");

    // Second workspace, then switch back and forth.
    await page.goto("/onboarding?new=1");
    const second = await createWorkspace(page, uniqueWorkspaceName("Second Co"));
    await page.goto("/app");
    await expect(page).toHaveURL(new RegExp(`/${second}/dashboard$`));
    await page.getByRole("button", { name: /Switch organization/ }).click();
    await page.getByRole("menuitem", { name: /First Co/ }).click();
    await expect(page).toHaveURL(new RegExp(`/${first}/dashboard$`));
    await page.goto("/app");
    await expect(page).toHaveURL(new RegExp(`/${first}/dashboard$`));
  });

  test("requiring MFA needs MFA first, then gates members without it", async ({
    page,
    browser,
  }) => {
    const ownerEmail = uniqueEmail("secure");
    const { totpSecret } = await createUser(ownerEmail, { totp: true, fullName: "Sam Secure" });
    await signIn(page, ownerEmail);
    await expect(page).toHaveURL(/\/login\/mfa/);
    await page.getByRole("textbox", { name: "Authentication code" }).fill(currentCode(totpSecret!));
    await page.getByRole("button", { name: "Verify" }).click();
    const slug = await createWorkspace(page, uniqueWorkspaceName("Secure Co"));

    const member = await newMember(browser, "plain");
    const link = await inviteTo(page, slug, member.email, "Read-only");
    await member.page.goto(new URL(link).pathname);
    await member.page.getByRole("button", { name: /Join / }).click();
    await expect(member.page).toHaveURL(new RegExp(`/${slug}/dashboard`));

    await page.goto(`/${slug}/settings`);
    await page.getByLabel("Require two-factor authentication").click();
    await expect(formAlert(page)).toContainText("now required");

    await member.page.goto(`/${slug}/dashboard`);
    await expect(member.page.getByRole("heading", { level: 1 })).toContainText(
      "Two-factor authentication required",
    );
    await expectNoSeriousA11y(member.page);
    await member.page.getByRole("link", { name: "Set up two-factor authentication" }).click();
    await expect(member.page).toHaveURL(/\/account\?notice=mfa-required$/);
    await member.context.close();
  });

  test("a workspace without MFA can't be locked by an admin who has none", async ({ page }) => {
    const email = uniqueEmail("nomfa");
    await createUser(email);
    await signIn(page, email);
    const slug = await createWorkspace(page, uniqueWorkspaceName("Open Co"));
    await page.goto(`/${slug}/settings`);
    await page.getByLabel("Require two-factor authentication").click();
    await expect(formAlert(page)).toContainText(
      "Set up two-factor authentication on your own account",
    );
    await expect(page.getByLabel("Require two-factor authentication")).not.toBeChecked();
  });
});
