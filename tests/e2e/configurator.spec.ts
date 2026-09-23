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

/**
 * A published, configurable product: a fabric choice, and a care-kit question
 * that only applies to velvet.
 */
async function workspaceWithSofa(page: Page) {
  const email = uniqueEmail("cfg");
  await createUser(email, { fullName: "Cass Configure" });
  await signIn(page, email);
  const slug = await createWorkspace(page, uniqueWorkspaceName("Sofa Co"));

  await page.goto(`/${slug}/catalog/categories`);
  await page.getByRole("button", { name: "New category" }).click();
  const category = page.getByRole("form", { name: "New category" });
  await category.getByRole("textbox", { name: "Name" }).fill("Seating");
  await category.getByRole("textbox", { name: "Code" }).fill("SEATING");
  await category.getByRole("button", { name: "Create category" }).click();
  await expect(formAlert(page)).toContainText("Seating added");

  await page.goto(`/${slug}/catalog/products/new`);
  const product = page.getByRole("form", { name: "New product" });
  await product.getByRole("textbox", { name: "Product name" }).fill("Three-seat sofa");
  await product.getByRole("textbox", { name: "Base price" }).fill("1200");
  await product.getByLabel("People choose options for this product").check();
  await product.getByRole("button", { name: "Create product" }).click();
  await expect(page).toHaveURL(/\/catalog\/products\/[^/]+\?created=1$/);
  const productUrl = page.url().replace("?created=1", "");

  // Fabric: standard (included) or velvet (+150).
  await page.getByRole("button", { name: "Add option group" }).click();
  const fabric = page.getByRole("form", { name: "New option group" });
  await fabric.getByRole("textbox", { name: "What are they choosing?" }).fill("Fabric");
  await fabric.getByLabel("They must choose before ordering").check();
  await fabric.getByRole("button", { name: "Add group" }).click();
  await expect(formAlert(page).first()).toContainText("Fabric added");

  for (const [label, delta] of [
    ["Standard weave", "0"],
    ["Olive velvet", "150"],
  ] as const) {
    await page.getByRole("button", { name: "Add option", exact: true }).click();
    const option = page.getByRole("form", { name: "New option" });
    await option.getByRole("textbox", { name: "Option" }).fill(label);
    await option.getByRole("textbox", { name: "Price change" }).fill(delta);
    await option.getByRole("button", { name: "Add option", exact: true }).click();
    await expect(formAlert(page).first()).toContainText(`${label} added`);
  }

  // Care kit: only asked when the fabric is velvet.
  await page.getByRole("button", { name: "Add option group" }).click();
  const care = page.getByRole("form", { name: "New option group" });
  await care.getByRole("textbox", { name: "What are they choosing?" }).fill("Velvet care kit");
  await care.getByLabel("How").selectOption("BOOLEAN");
  await care.getByLabel("Only ask when").selectOption({ label: "Fabric" });
  await care.getByLabel("…is").selectOption({ label: "Olive velvet" });
  await care.getByLabel("They must choose before ordering").check();
  await care.getByRole("button", { name: "Add group" }).click();
  await expect(formAlert(page).first()).toContainText("Velvet care kit added");
  await expect(page.getByText(/Asked only when Fabric is Olive velvet/)).toBeVisible();

  await page.getByRole("button", { name: "Publish" }).click();
  await expect(formAlert(page).first()).toContainText("now active");

  return { slug, productUrl };
}

test.beforeEach(async ({ page }) => {
  await isolateClientIp(page);
});

test.describe("configurator", () => {
  test("asks only the questions that apply, and prices as it goes", async ({ page }) => {
    const { productUrl } = await workspaceWithSofa(page);
    await page.goto(`${productUrl}/configure`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Configure Three-seat sofa",
    );
    await expectNoSeriousA11y(page);

    // The care kit question is hidden until velvet is chosen.
    await expect(page.getByLabel("Velvet care kit")).toHaveCount(0);
    await expect(page.getByTestId("configurator-unit")).toContainText("1,200");

    await page.getByLabel("Fabric").selectOption("standard_weave");
    await expect(page.getByLabel("Velvet care kit")).toHaveCount(0);
    await expect(page.getByText("Ready to save")).toBeVisible();

    await page.getByLabel("Fabric").selectOption("olive_velvet");
    await expect(page.getByTestId("configurator-unit")).toContainText("1,350");
    // Now it is asked — and required.
    await expect(page.getByLabel("Velvet care kit")).toBeVisible();
    await expect(page.getByText("1 question left")).toBeVisible();

    await page.getByRole("textbox", { name: "Name this configuration" }).fill("Harbor lobby");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(formAlert(page).first()).toContainText("Finish the questions marked below");
    await expect(
      page.getByRole("alert").filter({ hasText: "Choose Velvet care kit" }),
    ).toBeVisible();

    await page.getByLabel("Yes, include this").check();
    await page.getByRole("spinbutton", { name: "Quantity" }).fill("3");
    await expect(page.getByTestId("configurator-total")).toContainText("4,050");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(formAlert(page).first()).toContainText("Harbor lobby");

    // It shows up on the product, with the answers spelled out.
    await page.goto(productUrl);
    const saved = page.getByRole("list", { name: "Saved configurations" });
    await expect(saved).toContainText("Harbor lobby");
    await expect(saved).toContainText("Fabric: Olive velvet");
    await expect(saved).toContainText("3 ×");
  });

  test("a configuration can be put against a lead and shows up there", async ({ page }) => {
    const { slug, productUrl } = await workspaceWithSofa(page);

    await page.goto(`/${slug}/crm/leads/new`);
    const leadForm = page.getByRole("form", { name: "New lead" });
    await leadForm.getByRole("textbox", { name: "What do they want?" }).fill("Reception seating");
    await leadForm.getByRole("button", { name: "Create lead" }).click();
    await expect(page).toHaveURL(/\/crm\/leads\/[^/]+\?created=1$/);
    const leadUrl = page.url().replace("?created=1", "");

    await page.goto(`${productUrl}/configure`);
    await page.getByLabel("Fabric").selectOption("standard_weave");
    await page.getByRole("textbox", { name: "Name this configuration" }).fill("Reception sofas");
    const leadSelect = page.getByLabel("Put it against a lead");
    await expect(leadSelect.locator("option")).toHaveCount(2);
    await leadSelect.selectOption({ index: 1 });
    await page.getByRole("button", { name: "Save" }).click();
    await expect(formAlert(page).first()).toContainText("Reception sofas");

    await page.goto(leadUrl);
    const saved = page.getByRole("list", { name: "Saved configurations" });
    await expect(saved).toContainText("Reception sofas");
    await expect(saved).toContainText("Three-seat sofa");
    await expectNoSeriousA11y(page);

    // Removing it takes it off the lead again.
    await page.getByRole("button", { name: "Remove Reception sofas" }).click();
    await expect(formAlert(page).first()).toContainText("Configuration removed");
    await expect(page.getByText("Nothing configured yet")).toBeVisible();
  });

  test("a draft product can't be configured", async ({ page }) => {
    const { productUrl } = await workspaceWithSofa(page);
    await page.goto(productUrl);
    await page.getByRole("button", { name: "Back to draft" }).click();
    await expect(formAlert(page).first()).toContainText("now draft");

    await page.goto(`${productUrl}/configure`);
    await expect(page.getByText("This product isn't published")).toBeVisible();
    await expect(page.getByRole("form", { name: "Configure this product" })).toHaveCount(0);
  });
});
