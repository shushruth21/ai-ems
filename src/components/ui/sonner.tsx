"use client";

import { CircleAlert, CircleCheck, Info, LoaderCircle, TriangleAlert } from "lucide-react";
import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

export { toast } from "sonner";

export function Toaster(props: ToasterProps) {
  const { resolvedTheme } = useTheme();
  return (
    <Sonner
      theme={(resolvedTheme as ToasterProps["theme"]) ?? "system"}
      position="bottom-right"
      closeButton
      className="toaster group"
      icons={{
        success: <CircleCheck className="size-4 text-success" />,
        info: <Info className="size-4 text-info" />,
        warning: <TriangleAlert className="size-4 text-warning" />,
        error: <CircleAlert className="size-4 text-danger" />,
        loading: <LoaderCircle className="size-4 animate-spin" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            "rounded-lg! border-border! bg-surface-raised! text-foreground! shadow-lg! font-sans!",
          description: "text-muted-foreground!",
          actionButton: "bg-primary! text-primary-foreground!",
        },
      }}
      {...props}
    />
  );
}
