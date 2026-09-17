"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useMemo } from "react";

import { joinPath, navigationShortcuts } from "@/config/navigation";
import { useHotkeys, type HotkeyBinding } from "@ai-ems/ui/hooks/use-hotkeys";

import { useShell } from "./shell-context";

export function GlobalHotkeys() {
  const { navigation, basePath, setCommandOpen, commandOpen, toggleCollapsed, setShortcutsOpen } =
    useShell();
  const router = useRouter();

  const bindings = useMemo<HotkeyBinding[]>(
    () => [
      { keys: "mod+k", handler: () => setCommandOpen(!commandOpen) },
      { keys: "/", handler: () => setCommandOpen(true) },
      { keys: "[", handler: toggleCollapsed },
      { keys: "?", handler: () => setShortcutsOpen(true) },
      ...navigationShortcuts(navigation).map(({ keys, item }) => ({
        keys,
        handler: () => router.push(joinPath(basePath, item.href) as Route),
      })),
    ],
    [navigation, basePath, setCommandOpen, commandOpen, toggleCollapsed, setShortcutsOpen, router],
  );

  useHotkeys(bindings);
  return null;
}
