// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { deltaSentiment, KpiCard } from "@ai-ems/ui/components/data/kpi-card";
import { sparklinePath } from "@ai-ems/ui/components/data/sparkline";
import { StatusBadge } from "@ai-ems/ui/components/data/status-badge";
import { rangeLabel } from "@ai-ems/ui/components/data/data-table";
import { planLabel, switchOrgPath } from "@/components/layout/org-switcher";
import { initialsOf } from "@ai-ems/ui/components/ui/avatar";
import { Button } from "@ai-ems/ui/components/ui/button";

describe("Button", () => {
  it("defaults to type=button and handles clicks", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);
    const btn = screen.getByRole("button", { name: "Save" });
    expect(btn).toHaveAttribute("type", "button");
    await userEvent.click(btn);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("is disabled and busy while loading", async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Save
      </Button>,
    );
    const btn = screen.getByRole("button", { name: "Save" });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("aria-busy", "true");
    await userEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("renders its child with asChild", () => {
    render(
      <Button asChild variant="outline">
        <a href="https://example.com/x">Go</a>
      </Button>,
    );
    const link = screen.getByRole("link", { name: "Go" });
    expect(link).toHaveAttribute("data-variant", "outline");
    expect(link).not.toHaveAttribute("type");
  });
});

describe("data display", () => {
  it("StatusBadge shows a label and tone", () => {
    render(<StatusBadge status="PENDING_APPROVAL" />);
    const badge = screen.getByText("Pending approval");
    expect(badge).toHaveAttribute("data-status", "PENDING_APPROVAL");
    expect(badge.className).toContain("text-warning");
  });

  it("KpiCard colors the delta by whether up is good", () => {
    const { rerender } = render(
      <KpiCard label="Revenue" value="$1K" delta={0.1} deltaLabel="vs last month" />,
    );
    expect(screen.getByText("+10%").closest("span")?.className).toMatch(/text-success/);
    rerender(<KpiCard label="Overdue" value="$1K" delta={0.1} upIsGood={false} />);
    expect(screen.getByText("+10%").closest("span")?.className).toMatch(/text-danger/);
  });

  it("KpiCard exposes a loading state", () => {
    const { container } = render(<KpiCard label="x" value="" loading />);
    expect(container.querySelector("[aria-busy]")).not.toBeNull();
  });

  it("deltaSentiment", () => {
    expect(deltaSentiment(0.2)).toBe("positive");
    expect(deltaSentiment(-0.2)).toBe("negative");
    expect(deltaSentiment(0.2, false)).toBe("negative");
    expect(deltaSentiment(0)).toBe("neutral");
  });

  it("sparklinePath scales into the box", () => {
    const d = sparklinePath([0, 10], 100, 20, 0);
    expect(d).toBe("M0.00,20.00 L100.00,0.00");
    expect(sparklinePath([], 10, 10)).toBe("");
    expect(sparklinePath([5, 5], 10, 10, 0)).toBe("M0.00,10.00 L10.00,10.00");
  });

  it("rangeLabel", () => {
    expect(rangeLabel(0, 25, 132)).toBe("1–25 of 132");
    expect(rangeLabel(5, 25, 132)).toBe("126–132 of 132");
    expect(rangeLabel(0, 25, 0)).toBe("0 results");
  });

  it("helpers", () => {
    expect(initialsOf("Riley Morgan")).toBe("RM");
    expect(initialsOf("ada@example.com")).toBe("A");
    expect(initialsOf("mary-jane watson")).toBe("MW");
    expect(initialsOf("")).toBe("?");
    expect(planLabel("GROWTH")).toBe("Growth plan");
    expect(switchOrgPath("/preview/demo", "demo", "harborline")).toBe("/preview/harborline");
    expect(switchOrgPath("/demo", "demo", "acme")).toBe("/acme");
    expect(switchOrgPath("/x", "demo", "acme")).toBe("/acme");
  });
});
