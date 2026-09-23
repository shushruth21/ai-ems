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

/** A signed-in owner with an empty workspace. */
async function owner(page: Page) {
  const email = uniqueEmail("crm");
  await createUser(email, { fullName: "Cam Rivera" });
  await signIn(page, email);
  const slug = await createWorkspace(page, uniqueWorkspaceName("Furniture Co"));
  return { email, slug };
}

test.beforeEach(async ({ page }) => {
  await isolateClientIp(page);
});

test.describe("accounts and contacts", () => {
  test("an account and a contact can be created, edited and archived", async ({ page }) => {
    const { slug } = await owner(page);
    await page.goto(`/${slug}/crm/accounts`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Accounts");
    await expectNoSeriousA11y(page);

    await page.getByRole("button", { name: "New account" }).click();
    const accountForm = page.getByRole("form", { name: "New account" });
    await accountForm.getByRole("textbox", { name: "Company name" }).fill("Harbor Hotels");
    await accountForm.getByLabel("Type").selectOption("CUSTOMER");
    await accountForm.getByRole("textbox", { name: "Website" }).fill("harbor.example");
    await accountForm.getByRole("button", { name: "Create account" }).click();
    // A bare domain isn't a URL — the field says so rather than saving it.
    await expect(accountForm.getByText("Use a full URL")).toBeVisible();
    await accountForm.getByRole("textbox", { name: "Website" }).fill("https://harbor.example");
    await accountForm.getByRole("button", { name: "Create account" }).click();
    await expect(formAlert(page)).toContainText("Harbor Hotels added");

    const row = page.getByRole("row", { name: /Harbor Hotels/ });
    await expect(row).toContainText("Customer");

    await page.goto(`/${slug}/crm/contacts`);
    await page.getByRole("button", { name: "New contact" }).click();
    const contactForm = page.getByRole("form", { name: "New contact" });
    await contactForm.getByRole("textbox", { name: "First name" }).fill("Nia");
    await contactForm.getByRole("textbox", { name: "Last name" }).fill("Patel");
    await contactForm.getByRole("textbox", { name: "Email" }).fill("nia@harbor.example");
    await contactForm.getByLabel("Account").selectOption({ label: "Harbor Hotels" });
    await contactForm.getByRole("button", { name: "Create contact" }).click();
    await expect(formAlert(page)).toContainText("Nia added");
    await expect(page.getByRole("row", { name: /Nia Patel/ })).toContainText("Harbor Hotels");
    await expectNoSeriousA11y(page);

    // The account now shows the contact it gained.
    await page.goto(`/${slug}/crm/accounts`);
    await expect(page.getByRole("row", { name: /Harbor Hotels/ })).toContainText("1");
    await page.getByRole("button", { name: "Archive Harbor Hotels" }).click();
    await expect(formAlert(page)).toContainText("Account archived");
    await expect(page.getByRole("row", { name: /Harbor Hotels/ })).toHaveCount(0);
  });
});

test.describe("leads", () => {
  test("a lead is captured, worked and closed, with the timeline to match", async ({ page }) => {
    const { slug } = await owner(page);

    // A contact first, so the lead can be qualified.
    await page.goto(`/${slug}/crm/contacts`);
    await page.getByRole("button", { name: "New contact" }).click();
    const contactForm = page.getByRole("form", { name: "New contact" });
    await contactForm.getByRole("textbox", { name: "First name" }).fill("Tom");
    await contactForm.getByRole("textbox", { name: "Last name" }).fill("Okafor");
    await contactForm.getByRole("button", { name: "Create contact" }).click();
    await expect(formAlert(page)).toContainText("Tom added");

    await page.goto(`/${slug}/crm/leads`);
    await expect(page.getByText("No leads yet")).toBeVisible();
    await page.getByRole("button", { name: "New lead" }).click();

    const leadForm = page.getByRole("form", { name: "New lead" });
    await leadForm.getByRole("textbox", { name: "What do they want?" }).fill("Forty task chairs");
    await leadForm.getByLabel("Source").selectOption("WEBSITE");
    await leadForm.getByLabel("Contact").selectOption({ label: "Tom Okafor" });
    await leadForm.getByRole("textbox", { name: "Estimated value" }).fill("18,500");
    await leadForm.getByRole("button", { name: "Create lead" }).click();

    // Created leads open on their own page, numbered from the workspace sequence.
    await expect(page).toHaveURL(/\/crm\/leads\/[^/]+\?created=1$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Forty task chairs");
    await expect(page.getByText(/LD-\d{4}-00001/)).toBeVisible();
    await expectNoSeriousA11y(page);

    // Only the steps that make sense are offered.
    await expect(page.getByRole("button", { name: "Send proposal" })).toHaveCount(0);
    await page.getByRole("button", { name: "Mark contacted" }).click();
    await expect(formAlert(page).first()).toContainText("now contacted");
    await page.getByRole("button", { name: "Qualify", exact: true }).click();
    await page.getByRole("button", { name: "Send proposal" }).click();
    await expect(formAlert(page).first()).toContainText("now proposal");

    // Logging a call moves the follow-up date at the same time.
    const activityForm = page.getByRole("form", { name: "Log activity" });
    await activityForm.getByLabel("Type").selectOption("CALL");
    await activityForm
      .getByRole("textbox", { name: "What happened?" })
      .fill("Talked through fabric options");
    await activityForm.getByLabel("Next follow-up").fill("2027-03-01");
    await activityForm.getByRole("button", { name: "Log activity" }).click();
    await expect(page.getByRole("list", { name: "Activity timeline" })).toContainText(
      "Talked through fabric options",
    );

    // Closing as lost insists on a reason.
    await page.getByRole("button", { name: "Mark lost" }).click();
    const confirm = page.getByRole("button", { name: "Confirm" });
    await expect(confirm).toBeDisabled();
    await page.getByRole("textbox", { name: /Why was it lost/ }).fill("Chose a cheaper supplier");
    await confirm.click();
    await expect(formAlert(page).first()).toContainText("now lost");
    // The reason shows both in the summary and on the timeline.
    await expect(page.getByText("Chose a cheaper supplier")).toHaveCount(2);

    // And it can be picked up again later.
    await page.getByRole("button", { name: "Reopen" }).click();
    await expect(formAlert(page).first()).toContainText("now contacted");

    await page.goto(`/${slug}/crm/leads`);
    const row = page.getByRole("row", { name: /Forty task chairs/ });
    await expect(row).toContainText("Cam Rivera");
    await expect(row).toContainText("18,500");
  });

  test("the dashboard shows the pipeline once there are leads", async ({ page }) => {
    const { slug } = await owner(page);
    await page.goto(`/${slug}/crm/leads/new`);
    const leadForm = page.getByRole("form", { name: "New lead" });
    await leadForm.getByRole("textbox", { name: "What do they want?" }).fill("Showroom sofa");
    await leadForm.getByRole("textbox", { name: "Estimated value" }).fill("4200");
    await leadForm.getByRole("button", { name: "Create lead" }).click();
    await expect(page).toHaveURL(/\/crm\/leads\//);

    await page.goto(`/${slug}/dashboard`);
    await expect(page.getByText(/1 open lead worth/)).toBeVisible();
    await expect(page.locator("body")).toContainText("4,200");
  });
});

test.describe("permissions", () => {
  test("a read-only member can look but not touch", async ({ page, browser }) => {
    const { slug } = await owner(page);
    await page.goto(`/${slug}/crm/leads/new`);
    const leadForm = page.getByRole("form", { name: "New lead" });
    await leadForm.getByRole("textbox", { name: "What do they want?" }).fill("Reception desk");
    await leadForm.getByRole("button", { name: "Create lead" }).click();
    await expect(page).toHaveURL(/\/crm\/leads\//);

    // Invite a read-only colleague.
    const viewerEmail = uniqueEmail("viewer");
    await createUser(viewerEmail, { fullName: "Val Viewer" });
    await page.goto(`/${slug}/settings/members`);
    const inviteForm = page.getByRole("form", { name: "Invite a member" });
    await inviteForm.getByRole("textbox", { name: "Invite by email" }).fill(viewerEmail);
    await inviteForm.getByLabel("Role", { exact: true }).selectOption({ label: "Read-only" });
    await inviteForm.getByRole("button", { name: "Send invite" }).click();
    const link = (await page.getByTestId("invitation-link").textContent())!.trim();

    const context = await browser.newContext();
    const viewer = await context.newPage();
    await isolateClientIp(viewer);
    await signIn(viewer, viewerEmail);
    await expect(viewer).toHaveURL(/\/onboarding$/);
    await viewer.goto(new URL(link).pathname);
    await viewer.getByRole("button", { name: /Join / }).click();
    await expect(viewer).toHaveURL(new RegExp(`/${slug}/dashboard`));

    await viewer.goto(`/${slug}/crm/leads`);
    await expect(viewer.getByRole("row", { name: /Reception desk/ })).toBeVisible();
    await expect(viewer.getByRole("button", { name: "New lead" })).toHaveCount(0);
    // The create page itself refuses, not just the button.
    await viewer.goto(`/${slug}/crm/leads/new`);
    await expect(viewer.getByRole("form", { name: "New lead" })).toHaveCount(0);
    await context.close();
  });
});
