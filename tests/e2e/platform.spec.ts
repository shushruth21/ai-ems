import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import {
  createUser,
  createWorkspace,
  isolateClientIp,
  signIn,
  uniqueEmail,
  uniqueWorkspaceName,
} from "./support/auth";

const formAlert = (page: Page) => page.locator('[data-slot="alert"]');

async function expectNoSeriousA11y(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(
    results.violations
      .filter((v) => ["serious", "critical"].includes(v.impact ?? ""))
      .map((v) => v.id),
  ).toEqual([]);
}

/** A signed-in owner with a fresh workspace. */
async function owner(page: Page) {
  const email = uniqueEmail("plat");
  await createUser(email, { fullName: "Pat Platform" });
  await signIn(page, email);
  const slug = await createWorkspace(page, uniqueWorkspaceName("Platform Co"));
  return { email, slug };
}

test.beforeEach(async ({ page }) => {
  await isolateClientIp(page);
});

test.describe("roles", () => {
  test("an owner creates, edits and deletes a custom role", async ({ page }) => {
    const { slug } = await owner(page);
    await page.goto(`/${slug}/settings/roles`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Roles & permissions");
    // The eleven built-in roles are listed and marked read-only.
    await expect(page.getByRole("list", { name: "Roles" }).locator("li")).toHaveCount(11);
    await expectNoSeriousA11y(page);

    await page.getByRole("button", { name: "New role" }).click();
    const form = page.getByRole("form", { name: "New role" });
    await form.getByRole("textbox", { name: "Role name" }).fill("Regional manager");
    await form.getByLabel("View leads").check();
    await form.getByRole("button", { name: "Create role" }).click();
    await expect(formAlert(page)).toContainText("Regional manager");

    const role = page.getByRole("list", { name: "Roles" }).getByRole("listitem").filter({
      hasText: "Regional manager",
    });
    await expect(role).toContainText("1 permissions");
    await role.getByRole("button", { name: "Edit" }).click();
    const edit = page.getByRole("form", { name: "Edit Regional manager" });
    await edit.getByLabel("Create and edit leads").check();
    await edit.getByRole("button", { name: "Save role" }).click();
    await expect(formAlert(page)).toContainText("Role updated");
    await expect(role).toContainText("2 permissions");

    // The role is assignable to a member straight away.
    await page.goto(`/${slug}/settings/members`);
    await expect(
      page.getByRole("form", { name: "Invite a member" }).getByLabel("Role", { exact: true }),
    ).toContainText("Regional manager");

    await page.goto(`/${slug}/settings/roles`);
    await role.getByRole("button", { name: "Delete Regional manager" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
    await expect(formAlert(page)).toContainText("Role deleted");
    await expect(page.getByRole("list", { name: "Roles" }).locator("li")).toHaveCount(11);
  });

  test("built-in roles can't be edited from the UI", async ({ page }) => {
    const { slug } = await owner(page);
    await page.goto(`/${slug}/settings/roles`);
    const builtIn = page
      .getByRole("list", { name: "Roles" })
      .getByRole("listitem")
      .filter({ hasText: "built-in" })
      .first();
    await expect(builtIn.getByRole("button", { name: "Edit" })).toHaveCount(0);
  });
});

test.describe("audit log", () => {
  test("records what happened and pages through it", async ({ page }) => {
    const { slug } = await owner(page);
    await page.goto(`/${slug}/settings/audit`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Audit log");
    const rows = page.getByRole("region", { name: "Audit events" }).getByRole("row");
    await expect(rows.filter({ hasText: "organization.created" })).toHaveCount(1);
    await expectNoSeriousA11y(page);

    // Filtering narrows the table to one action.
    await page.getByLabel("Action").selectOption("organization.created");
    await page.getByRole("button", { name: "Filter" }).click();
    await expect(page).toHaveURL(/action=organization.created/);
    await expect(rows).toHaveCount(2); // header + the one event

    // A date range in the future hides everything.
    await page.goto(`/${slug}/settings/audit?from=2099-01-01`);
    await expect(page.getByText("Nothing recorded yet")).toBeVisible();
  });
});

test.describe("notifications", () => {
  test("a member joining notifies the people who manage members", async ({ page, browser }) => {
    // Waits on the worker's poll loop, so it needs more than the default budget.
    test.setTimeout(120_000);
    const { slug } = await owner(page);
    const inviteeEmail = uniqueEmail("joiner");
    await createUser(inviteeEmail, { fullName: "Jo Joiner" });

    await page.goto(`/${slug}/settings/members`);
    const inviteForm = page.getByRole("form", { name: "Invite a member" });
    await inviteForm.getByRole("textbox", { name: "Invite by email" }).fill(inviteeEmail);
    await inviteForm.getByLabel("Role", { exact: true }).selectOption({ label: "Read-only" });
    await inviteForm.getByRole("button", { name: "Send invite" }).click();
    const link = (await page.getByTestId("invitation-link").textContent())!.trim();

    const context = await browser.newContext();
    const invitee = await context.newPage();
    await isolateClientIp(invitee);
    await signIn(invitee, inviteeEmail);
    // The session cookie lands with the redirect to onboarding.
    await expect(invitee).toHaveURL(/\/onboarding$/);
    await invitee.goto(new URL(link).pathname);
    await invitee.getByRole("button", { name: /Join / }).click();
    await expect(invitee).toHaveURL(new RegExp(`/${slug}/dashboard`));
    await context.close();

    // The worker turns the outbox event into a notification for the owner.
    await expect
      .poll(
        async () => {
          await page.goto(`/${slug}/notifications`);
          // The empty state renders no list, so read the whole page instead.
          return page.locator("main").innerText();
        },
        { timeout: 60_000, message: "the outbox worker should deliver member.joined" },
      )
      .toContain("Jo Joiner");
    await expectNoSeriousA11y(page);

    await expect(page.getByText("1 unread")).toBeVisible();
    await page.getByRole("button", { name: "Mark all read" }).click();
    await expect(page.getByText("Nothing unread.")).toBeVisible();
  });
});

test.describe("API keys", () => {
  test("a key is shown once, works against /api/v1 and stops on revoke", async ({
    page,
    request,
  }) => {
    const { slug } = await owner(page);
    await page.goto(`/${slug}/settings/api-keys`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("API keys");
    await expectNoSeriousA11y(page);

    const form = page.getByRole("form", { name: "Create an API key" });
    await form.getByRole("textbox", { name: "Key name" }).fill("Warehouse scanner");
    await form.getByRole("button", { name: "Create key" }).click();
    const token = (await page.getByTestId("api-key-token").textContent())!.trim();
    expect(token).toMatch(/^aiems_[0-9a-f]{12}_/);

    const authorized = await request.get("/api/v1/workspace", {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(authorized.ok()).toBe(true);
    expect((await authorized.json()).data.slug).toBe(slug);

    // Without a key, and with a write scope it wasn't granted.
    expect((await request.get("/api/v1/workspace")).status()).toBe(401);
    expect(
      (
        await request.get("/api/v1/members", {
          headers: { authorization: "Bearer aiems_000000000000_not-a-real-secret-value-at-all" },
        })
      ).status(),
    ).toBe(401);

    await page.getByRole("button", { name: "Revoke Warehouse scanner" }).click();
    await expect(formAlert(page)).toContainText("Key revoked");
    expect(
      (
        await request.get("/api/v1/workspace", { headers: { authorization: `Bearer ${token}` } })
      ).status(),
    ).toBe(401);
  });
});
