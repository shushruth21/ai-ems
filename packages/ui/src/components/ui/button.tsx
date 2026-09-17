import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type { ComponentProps } from "react";

import { cn } from "../../lib/utils";

import { Spinner } from "./spinner";

export const buttonVariants = cva(
  [
    "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md font-medium whitespace-nowrap select-none",
    "transition-[color,background-color,border-color,box-shadow] duration-(--duration-fast)",
    "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "disabled:pointer-events-none disabled:opacity-50 aria-busy:cursor-progress",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ],
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground shadow-xs hover:bg-primary-hover",
        secondary: "bg-muted text-foreground hover:bg-border",
        outline:
          "border border-input bg-surface text-foreground shadow-xs hover:border-border-strong hover:bg-muted",
        ghost: "text-foreground hover:bg-muted",
        danger: "bg-danger text-danger-foreground shadow-xs hover:bg-danger-hover",
        "danger-outline": "border border-danger-border bg-surface text-danger hover:bg-danger-bg",
        ai: "border border-ai-border bg-ai-bg text-ai hover:border-ai",
        link: "h-auto px-0 text-primary underline-offset-4 hover:underline",
      },
      size: {
        xs: "h-7 px-2 text-xs",
        sm: "h-(--control-h-sm) px-2.5 text-sm",
        md: "h-(--control-h) px-3 text-base",
        lg: "h-(--control-h-lg) px-4 text-md",
        icon: "size-(--control-h)",
        "icon-sm": "size-(--control-h-sm)",
        "icon-xs": "size-7 [&_svg:not([class*='size-'])]:size-3.5",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps extends ComponentProps<"button">, VariantProps<typeof buttonVariants> {
  /** Render the child element (e.g. a Link) with button styles. */
  asChild?: boolean;
  /** Shows a spinner, disables the button and sets aria-busy. */
  loading?: boolean;
}

export function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  disabled,
  children,
  type,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      data-slot="button"
      data-variant={variant ?? "primary"}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={asChild ? undefined : disabled || loading}
      aria-busy={loading || undefined}
      type={asChild ? undefined : (type ?? "button")}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {loading ? <Spinner aria-hidden label="" role="presentation" /> : null}
          {children}
        </>
      )}
    </Comp>
  );
}
