import {
  breadcrumbsFor,
  filterNavigation,
  findActiveItem,
  joinPath,
  NAVIGATION,
  navigationShortcuts,
} from "./navigation";

const base = "/preview/demo";
const all = new Set<string>(
  NAVIGATION.flatMap((s) => s.items).flatMap((i) => (i.permission ? [i.permission] : [])),
);

describe("navigation", () => {
  it("has unique ids, hrefs and shortcuts", () => {
    const items = NAVIGATION.flatMap((s) => s.items);
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
    expect(new Set(items.map((i) => i.href)).size).toBe(items.length);
    const shortcuts = items.flatMap((i) => (i.shortcut ? [i.shortcut] : []));
    expect(new Set(shortcuts).size).toBe(shortcuts.length);
  });

  it("hides items without permission and drops empty sections", () => {
    const nav = filterNavigation(NAVIGATION, new Set(["crm.lead.read"]));
    const ids = nav.flatMap((s) => s.items.map((i) => i.id));
    expect(ids).toContain("leads");
    expect(ids).toContain("dashboard"); // no permission required
    expect(ids).not.toContain("orders");
    expect(nav.find((s) => s.id === "admin")).toBeUndefined();
  });

  it("shows everything to a user with all permissions", () => {
    const nav = filterNavigation(NAVIGATION, all);
    expect(nav.flatMap((s) => s.items)).toHaveLength(NAVIGATION.flatMap((s) => s.items).length);
  });

  it("joins paths without double slashes", () => {
    expect(joinPath("/preview/demo/", "/sales")).toBe("/preview/demo/sales");
    expect(joinPath("/demo", "sales")).toBe("/demo/sales");
    expect(joinPath("", "/x")).toBe("/x");
  });

  it("matches the longest prefix as active", () => {
    expect(findActiveItem(NAVIGATION, `${base}/settings/members`, base)?.id).toBe("members");
    expect(findActiveItem(NAVIGATION, `${base}/settings/general`, base)?.id).toBe("settings");
    expect(findActiveItem(NAVIGATION, `${base}/sales/orders/SO-1`, base)?.id).toBe("orders");
    expect(findActiveItem(NAVIGATION, `${base}/sales/ordersx`, base)).toBeUndefined();
  });

  it("builds breadcrumbs with section, item and detail segments", () => {
    expect(breadcrumbsFor(NAVIGATION, `${base}/sales/orders`, base)).toEqual([
      { label: "Sell" },
      { label: "Sales orders", href: undefined },
    ]);
    expect(
      breadcrumbsFor(NAVIGATION, `${base}/sales/orders/SO-2026-00001/line-items`, base),
    ).toEqual([
      { label: "Sell" },
      { label: "Sales orders", href: `${base}/sales/orders` },
      { label: "SO-2026-00001", href: `${base}/sales/orders/SO-2026-00001` },
      { label: "Line items", href: undefined },
    ]);
    expect(breadcrumbsFor(NAVIGATION, `${base}/dashboard`, base)).toEqual([
      { label: "Dashboard", href: undefined },
    ]);
    expect(breadcrumbsFor(NAVIGATION, "/elsewhere", base)).toEqual([]);
  });

  it("derives g-shortcuts", () => {
    const keys = navigationShortcuts(NAVIGATION).map((s) => s.keys);
    expect(keys).toContain("g o");
    expect(keys).toContain("g h");
  });
});
