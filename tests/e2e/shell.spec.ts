import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const PAGES = [
  "/preview/demo/dashboard",
  "/preview/demo/sales/orders",
  "/preview/demo/design-system",
];

function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

async function expectNoSeriousA11y(page: Page) {
  // Let entrance animations settle so contrast is measured at full opacity.
  // Infinite animations (spinners, skeleton shimmer) are ignored.
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .filter((a) => a.effect?.getTiming().iterations !== Infinity)
      .every((a) => a.playState !== "running"),
  );
  await page.waitForTimeout(300);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  const serious = results.violations.filter((v) =>
    ["serious", "critical"].includes(v.impact ?? ""),
  );
  expect(
    serious.map(
      (v) =>
        `${v.id}: ${v.nodes
          .map((n) => n.target.join(" "))
          .slice(0, 3)
          .join(", ")}`,
    ),
  ).toEqual([]);
}

test.describe("app shell (preview)", () => {
  for (const path of PAGES) {
    test(`${path} renders cleanly in light and dark`, async ({ page }) => {
      const errors = trackErrors(page);
      await page.goto(path);
      await expect(page.getByRole("main")).toBeVisible();
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await page.waitForLoadState("networkidle");
      await expectNoSeriousA11y(page);

      await page.emulateMedia({ colorScheme: "dark" });
      await page.reload();
      await expect(page.locator("html")).toHaveClass(/dark/);
      await expectNoSeriousA11y(page);
      expect(errors, errors.join("\n")).toEqual([]);
    });

    test(`${path} never scrolls sideways`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }

  test("/preview redirects to the demo dashboard; unknown orgs 404", async ({ page }) => {
    await page.goto("/preview");
    await expect(page).toHaveURL(/\/preview\/demo\/dashboard$/);
    const res = await page.goto("/preview/no-such-org/dashboard");
    expect(res?.status()).toBe(404);
  });

  test("planned modules show their phase", async ({ page }) => {
    await page.goto("/preview/demo/crm/leads");
    await expect(page.getByText("Arrives in Phase 6")).toBeVisible();
  });
});

test.describe("desktop interactions", () => {
  test.skip(({ isMobile }) => isMobile, "keyboard-first flows");

  test("command palette navigates", async ({ page }) => {
    await page.goto("/preview/demo/dashboard");
    await page.keyboard.press("ControlOrMeta+k");
    const dialog = page.getByRole("dialog", { name: "Command palette" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("combobox").fill("sales orders");
    await expect(dialog.getByRole("option").first()).toHaveText(/Sales orders/);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/sales\/orders$/);
    await expect(page.getByRole("heading", { level: 1, name: "Sales orders" })).toBeVisible();
  });

  test("g-sequences navigate and ? opens help", async ({ page }) => {
    await page.goto("/preview/demo/sales/orders");
    await page.getByRole("heading", { level: 1 }).click();
    await page.keyboard.press("g");
    await page.keyboard.press("h");
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.keyboard.press("Shift+?");
    await expect(page.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeVisible();
  });

  test("sidebar collapse persists across reloads", async ({ page }) => {
    await page.goto("/preview/demo/dashboard");
    const sidebar = page.getByRole("complementary", { name: "Sidebar" });
    await expect(sidebar).toHaveAttribute("data-collapsed", "false");
    await page.getByRole("button", { name: "Collapse sidebar" }).click();
    await expect(sidebar).toHaveAttribute("data-collapsed", "true");
    await page.reload();
    await expect(page.getByRole("complementary", { name: "Sidebar" })).toHaveAttribute(
      "data-collapsed",
      "true",
    );
  });

  test("theme choice persists", async ({ page }) => {
    await page.goto("/preview/demo/dashboard");
    await page.getByRole("button", { name: "Switch to dark theme" }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await page.reload();
    await expect(page.locator("html")).toHaveClass(/dark/);
  });

  test("orders table: search, select, bulk action, detail drawer", async ({ page }) => {
    await page.goto("/preview/demo/sales/orders");
    const table = page.getByRole("table", { name: "Sales orders" });
    await page.getByRole("searchbox", { name: "Search table" }).fill("Crescent");
    await expect(table.getByRole("row").nth(1)).toContainText("Crescent Clinics");
    await table.getByRole("checkbox", { name: "Select row" }).first().check();
    await expect(page.getByText("1 selected").first()).toBeVisible();
    await page.getByRole("button", { name: "Export" }).click();
    await expect(page.getByText(/Prepared an export of 1 orders/)).toBeVisible();
    await table.getByRole("row").nth(1).click();
    await expect(page.getByRole("dialog")).toContainText("Crescent Clinics");
  });

  test("design system form validates", async ({ page }) => {
    await page.goto("/preview/demo/design-system");
    await page.getByRole("button", { name: "Validate lead" }).click();
    await expect(page.getByText("Enter at least 2 characters")).toBeVisible();
    await expect(page.getByRole("textbox", { name: /Company/ })).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });
});

test.describe("mobile", () => {
  test.skip(({ isMobile }) => !isMobile, "mobile only");

  test("navigation drawer opens and navigates", async ({ page }) => {
    await page.goto("/preview/demo/dashboard");
    await expect(page.getByRole("complementary", { name: "Sidebar" })).toBeHidden();
    await page.getByRole("button", { name: "Open navigation" }).click();
    const drawer = page.getByRole("dialog", { name: "Navigation" });
    await drawer.getByRole("link", { name: "Sales orders" }).click();
    await expect(page).toHaveURL(/\/sales\/orders$/);
    await expect(drawer).toBeHidden();
  });
});
