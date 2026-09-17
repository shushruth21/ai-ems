"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import { SimpleTooltip } from "@/components/ui/tooltip";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const next = resolvedTheme === "dark" ? "light" : "dark";
  return (
    <SimpleTooltip label={`Switch to ${next} theme`}>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => setTheme(next)}
        aria-label={`Switch to ${next} theme`}
      >
        <Sun className="dark:hidden" />
        <Moon className="hidden dark:block" />
      </Button>
    </SimpleTooltip>
  );
}
