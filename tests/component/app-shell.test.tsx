// @vitest-environment jsdom
import { act, fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { navigationState, nextNavigationMock, routerMock } from "../utils/next-navigation";
import { renderShell } from "../utils/render-shell";

vi.mock("next/navigation", () => nextNavigationMock());

beforeEach(() => {
  navigationState.pathname = "/preview/demo/sales/orders";
  routerMock.push.mockClear();
  document.cookie = "aiems-sidebar=; max-age=0; path=/";
});

describe("AppShell", () => {
  it("renders landmarks, a skip link and the current page", () => {
    renderShell();
    expect(screen.getByRole("link", { name: "Skip to content" })).toHaveAttribute(
      "href",
      "#main-content",
    );
    expect(screen.getByRole("main")).toHaveTextContent("Page body");
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(within(nav).getByRole("link", { name: "Sales orders" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toHaveTextContent(
      "Sales orders",
    );
  });

  it("only shows navigation the user is allowed to see", () => {
    renderShell(undefined, { permissions: ["crm.lead.read"] });
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(within(nav).getByRole("link", { name: "Leads" })).toBeInTheDocument();
    expect(within(nav).queryByRole("link", { name: "Sales orders" })).not.toBeInTheDocument();
    expect(within(nav).queryByRole("link", { name: "Settings" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Ask AI/ })).not.toBeInTheDocument();
  });

  it("collapses the sidebar and remembers it in a cookie", async () => {
    const user = userEvent.setup();
    renderShell();
    await user.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    expect(screen.getByRole("complementary", { name: "Sidebar" })).toHaveAttribute(
      "data-collapsed",
      "true",
    );
    expect(document.cookie).toContain("aiems-sidebar=collapsed");
    fireEvent.keyDown(window, { key: "[" });
    expect(screen.getByRole("complementary", { name: "Sidebar" })).toHaveAttribute(
      "data-collapsed",
      "false",
    );
  });

  it("opens the command palette with Ctrl+K and navigates", async () => {
    const user = userEvent.setup();
    renderShell();
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    const dialog = await screen.findByRole("dialog", { name: "Command palette" });
    await user.type(within(dialog).getByRole("combobox"), "purchasing");
    await user.keyboard("{Enter}");
    expect(routerMock.push).toHaveBeenCalledWith("/preview/demo/procurement/purchase-orders");
    expect(screen.queryByRole("dialog", { name: "Command palette" })).not.toBeInTheDocument();
  });

  it("hides create actions without permission", async () => {
    renderShell(undefined, { permissions: ["sales.order.read"] });
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    const dialog = await screen.findByRole("dialog", { name: "Command palette" });
    expect(within(dialog).queryByText("New purchase order")).not.toBeInTheDocument();
    expect(within(dialog).getByText("Sales orders")).toBeInTheDocument();
  });

  it("supports g-sequences and the shortcuts dialog", async () => {
    renderShell();
    act(() => {
      fireEvent.keyDown(window, { key: "g" });
      fireEvent.keyDown(window, { key: "i" });
    });
    expect(routerMock.push).toHaveBeenCalledWith("/preview/demo/inventory/items");
    fireEvent.keyDown(window, { key: "?", shiftKey: true });
    const dialog = await screen.findByRole("dialog", { name: "Keyboard shortcuts" });
    expect(within(dialog).getByText("Sales orders")).toBeInTheDocument();
  });

  it("ignores plain shortcuts while typing", () => {
    renderShell(<input aria-label="Notes" />);
    const input = screen.getByRole("textbox", { name: "Notes" });
    fireEvent.keyDown(input, { key: "g" });
    fireEvent.keyDown(input, { key: "o" });
    fireEvent.keyDown(input, { key: "[" });
    expect(routerMock.push).not.toHaveBeenCalled();
    expect(screen.getByRole("complementary", { name: "Sidebar" })).toHaveAttribute(
      "data-collapsed",
      "false",
    );
  });

  it("opens the mobile navigation drawer", async () => {
    const user = userEvent.setup();
    renderShell();
    await user.click(screen.getByRole("button", { name: "Open navigation" }));
    const drawer = await screen.findByRole("dialog", { name: "Navigation" });
    await user.click(within(drawer).getByRole("link", { name: "Leads" }));
    expect(screen.queryByRole("dialog", { name: "Navigation" })).not.toBeInTheDocument();
  });
});
