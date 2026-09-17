// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { leadFormSchema, SampleForm } from "@/features/preview/components/gallery/sample-form";

vi.mock("@/components/ui/sonner", () => ({ toast: { success: vi.fn() } }));

describe("form bindings", () => {
  it("links errors to fields and blocks invalid submits", async () => {
    const user = userEvent.setup();
    render(<SampleForm />);
    await user.click(screen.getByRole("button", { name: "Validate lead" }));

    const company = await screen.findByRole("textbox", { name: /Company/ });
    expect(company).toHaveAttribute("aria-invalid", "true");
    const describedBy = company.getAttribute("aria-describedby") ?? "";
    const message = screen.getByText("Enter at least 2 characters");
    expect(describedBy.split(" ")).toContain(message.id);
    expect(screen.getByText("Consent is required")).toBeInTheDocument();
  });

  it("accepts valid input", async () => {
    const { toast } = await import("@/components/ui/sonner");
    const user = userEvent.setup();
    render(<SampleForm />);
    await user.type(screen.getByRole("textbox", { name: /Company/ }), "Acme Studio");
    await user.type(screen.getByRole("textbox", { name: /Email/ }), "buyer@example.com");
    await user.click(screen.getByRole("combobox", { name: /Source/ }));
    await user.click(await screen.findByRole("option", { name: "Referral" }));
    await user.click(screen.getByRole("checkbox", { name: /agreed/ }));
    await user.click(screen.getByRole("button", { name: "Validate lead" }));
    await vi.waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Lead validated", {
        description: "Acme Studio · REFERRAL",
      }),
    );
  });

  it("schema coerces and bounds the value", () => {
    const base = {
      company: "Ac",
      email: "a@b.co",
      source: "PHONE",
      priority: "LOW",
      followUp: false,
      consent: true,
    } as const;
    expect(leadFormSchema.parse({ ...base, value: "1500" }).value).toBe(1500);
    expect(leadFormSchema.safeParse({ ...base, value: "-1" }).success).toBe(false);
    expect(leadFormSchema.safeParse({ ...base, value: "10", consent: false }).success).toBe(false);
  });
});
