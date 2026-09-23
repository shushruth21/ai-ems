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

async function owner(page: Page) {
  const email = uniqueEmail("cat");
  await createUser(email, { fullName: "Kit Catalog" });
  await signIn(page, email);
  const slug = await createWorkspace(page, uniqueWorkspaceName("Maker Co"));
  return { email, slug };
}

/** Every product needs a category, so most tests start with one. */
async function addCategory(page: Page, slug: string, name: string, code: string) {
  await page.goto(`/${slug}/catalog/categories`);
  await page.getByRole("button", { name: "New category" }).click();
  const form = page.getByRole("form", { name: "New category" });
  await form.getByRole("textbox", { name: "Name" }).fill(name);
  await form.getByRole("textbox", { name: "Code" }).fill(code);
  await form.getByRole("button", { name: "Create category" }).click();
  await expect(formAlert(page)).toContainText(`${name} added`);
}

test.beforeEach(async ({ page }) => {
  await isolateClientIp(page);
});

test.describe("categories", () => {
  test("a category is created, nested and protected while in use", async ({ page }) => {
    const { slug } = await owner(page);
    await page.goto(`/${slug}/catalog/categories`);
    await expect(page.getByText("No categories yet")).toBeVisible();
    await expectNoSeriousA11y(page);

    await addCategory(page, slug, "Seating", "SEATING");
    await page.getByRole("button", { name: "New category" }).click();
    const form = page.getByRole("form", { name: "New category" });
    await form.getByRole("textbox", { name: "Name" }).fill("Sofas");
    await form.getByRole("textbox", { name: "Code" }).fill("SOFAS");
    await form.getByLabel("Inside").selectOption({ label: "Seating" });
    await form.getByRole("button", { name: "Create category" }).click();
    await expect(page.getByRole("row", { name: /Sofas/ })).toContainText("Seating");

    // Codes are unique, and typed in any case.
    await page.getByRole("button", { name: "New category" }).click();
    const dup = page.getByRole("form", { name: "New category" });
    await dup.getByRole("textbox", { name: "Name" }).fill("Duplicate");
    await dup.getByRole("textbox", { name: "Code" }).fill("seating");
    await dup.getByRole("button", { name: "Create category" }).click();
    await expect(dup.getByText(/already in use/)).toBeVisible();
  });
});

test.describe("products", () => {
  test("a configurable product can't be published until it has options", async ({ page }) => {
    const { slug } = await owner(page);
    await addCategory(page, slug, "Seating", "SEATING");

    await page.goto(`/${slug}/catalog/products`);
    await expect(page.getByText("Nothing in the catalog yet")).toBeVisible();
    await page.getByRole("button", { name: "New product" }).click();

    const form = page.getByRole("form", { name: "New product" });
    await form.getByRole("textbox", { name: "Product name" }).fill("Aurora lounge chair");
    // The SKU follows the name until someone edits it themselves.
    await expect(form.getByRole("textbox", { name: "SKU" })).toHaveValue("AURORA-LOUNGE-CHAIR");
    await form.getByRole("textbox", { name: "Base price" }).fill("640");
    await form.getByLabel("People choose options for this product").check();
    await form.getByRole("button", { name: "Create product" }).click();

    await expect(page).toHaveURL(/\/catalog\/products\/[^/]+\?created=1$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Aurora lounge chair");
    await expectNoSeriousA11y(page);

    // Nothing to publish yet — the product says why.
    await expect(page.getByText(/needs at least one option group/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Publish" })).toHaveCount(0);

    await page.getByRole("button", { name: "Add option group" }).click();
    const groupForm = page.getByRole("form", { name: "New option group" });
    await groupForm.getByRole("textbox", { name: "What are they choosing?" }).fill("Fabric colour");
    await groupForm.getByRole("button", { name: "Add group" }).click();
    await expect(formAlert(page).first()).toContainText("Fabric colour added");
    await expect(page.getByText("Nothing to choose from yet.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Publish" })).toHaveCount(0);

    await page.getByRole("button", { name: "Add option", exact: true }).click();
    const optionForm = page.getByRole("form", { name: "New option" });
    await optionForm.getByRole("textbox", { name: "Option" }).fill("Olive velvet");
    await optionForm.getByRole("textbox", { name: "Price change" }).fill("150");
    await optionForm.getByRole("button", { name: "Add option", exact: true }).click();
    await expect(formAlert(page).first()).toContainText("Olive velvet added");

    // Now it can go live.
    await page.getByRole("button", { name: "Publish" }).click();
    await expect(formAlert(page).first()).toContainText("now active");

    // The price preview follows the options.
    await expect(page.getByTestId("price-preview")).toContainText("640");
    await page.getByLabel("Fabric colour", { exact: true }).selectOption({ label: "Olive velvet" });
    await expect(page.getByTestId("price-preview")).toContainText("790");

    await page.goto(`/${slug}/catalog/products`);
    const row = page.getByRole("row", { name: /Aurora lounge chair/ });
    await expect(row).toContainText(/active/i);
    await expect(row).toContainText("640");
  });

  test("SKUs can't collide, and a draft can be thrown away", async ({ page }) => {
    const { slug } = await owner(page);
    await addCategory(page, slug, "Tables", "TABLE");

    await page.goto(`/${slug}/catalog/products/new`);
    const form = page.getByRole("form", { name: "New product" });
    await form.getByRole("textbox", { name: "Product name" }).fill("Contour desk");
    await form.getByRole("textbox", { name: "SKU" }).fill("DESK-120");
    await form.getByRole("textbox", { name: "Base price" }).fill("890");
    await form.getByRole("button", { name: "Create product" }).click();
    await expect(page).toHaveURL(/\/catalog\/products\//);

    await page.goto(`/${slug}/catalog/products/new`);
    const second = page.getByRole("form", { name: "New product" });
    await second.getByRole("textbox", { name: "Product name" }).fill("Another desk");
    await second.getByRole("textbox", { name: "SKU" }).fill("desk-120");
    await second.getByRole("textbox", { name: "Base price" }).fill("500");
    await second.getByRole("button", { name: "Create product" }).click();
    await expect(second.getByText(/already in use/)).toBeVisible();

    await page.goto(`/${slug}/catalog/products`);
    await page.getByRole("row", { name: /Contour desk/ }).click();
    await page.getByRole("button", { name: "Delete draft" }).click();
    await expect(page).toHaveURL(/\/catalog\/products\?deleted=1$/);
    await expect(page.getByText("Nothing in the catalog yet")).toBeVisible();
  });
});

test.describe("permissions", () => {
  test("a read-only member sees the catalog but no editing", async ({ page, browser }) => {
    const { slug } = await owner(page);
    await addCategory(page, slug, "Storage", "STORAGE");
    await page.goto(`/${slug}/catalog/products/new`);
    const form = page.getByRole("form", { name: "New product" });
    await form.getByRole("textbox", { name: "Product name" }).fill("Stack cabinet");
    await form.getByRole("textbox", { name: "Base price" }).fill("420");
    await form.getByRole("button", { name: "Create product" }).click();
    await expect(page).toHaveURL(/\/catalog\/products\//);

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

    await viewer.goto(`/${slug}/catalog/products`);
    await expect(viewer.getByRole("row", { name: /Stack cabinet/ })).toBeVisible();
    await expect(viewer.getByRole("button", { name: "New product" })).toHaveCount(0);
    await viewer.getByRole("row", { name: /Stack cabinet/ }).click();
    await expect(viewer.getByRole("button", { name: "Edit" })).toHaveCount(0);
    await expect(viewer.getByRole("button", { name: "Publish" })).toHaveCount(0);
    await context.close();
  });
});
