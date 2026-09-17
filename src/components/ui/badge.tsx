import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

export const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center gap-1 rounded-sm border px-1.5 py-px text-xs font-medium whitespace-nowrap [&_svg]:size-3 [&_svg]:shrink-0",
  {
    variants: {
      tone: {
        neutral: "border-neutral-border bg-neutral-bg text-neutral",
        info: "border-info-border bg-info-bg text-info",
        success: "border-success-border bg-success-bg text-success",
        warning: "border-warning-border bg-warning-bg text-warning",
        danger: "border-danger-border bg-danger-bg text-danger",
        primary: "border-transparent bg-accent text-accent-foreground",
        ai: "border-ai-border bg-ai-bg text-ai",
        outline: "border-border bg-transparent text-muted-foreground",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>["tone"]>;

export interface BadgeProps extends ComponentProps<"span">, VariantProps<typeof badgeVariants> {
  asChild?: boolean;
  /** Shows a leading status dot. */
  dot?: boolean;
}

export function Badge({
  className,
  tone,
  asChild = false,
  dot = false,
  children,
  ...props
}: BadgeProps) {
  const Comp = asChild ? Slot.Root : "span";
  return (
    <Comp data-slot="badge" className={cn(badgeVariants({ tone }), className)} {...props}>
      {dot ? <span aria-hidden className="size-1.5 rounded-full bg-current" /> : null}
      {children}
    </Comp>
  );
}
