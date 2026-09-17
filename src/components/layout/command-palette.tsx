"use client";

import { Keyboard, Monitor, Moon, PanelLeft, Plus, Sun } from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useCallback } from "react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { Kbd } from "@/components/ui/kbd";
import { joinPath } from "@/config/navigation";
import { quickActions } from "@/config/quick-actions";

import { useShell } from "./shell-context";

export function CommandPalette() {
  const {
    commandOpen,
    setCommandOpen,
    navigation,
    basePath,
    can,
    toggleCollapsed,
    setShortcutsOpen,
  } = useShell();
  const router = useRouter();
  const { setTheme } = useTheme();

  const run = useCallback(
    (fn: () => void) => {
      setCommandOpen(false);
      fn();
    },
    [setCommandOpen],
  );
  const go = (href: string) => run(() => router.push(joinPath(basePath, href) as Route));
  const actions = quickActions.filter((a) => can(a.permission));

  return (
    <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
      <CommandInput placeholder="Search pages, actions and settings…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {navigation.map((section) => (
          <CommandGroup key={section.id} heading={section.title}>
            {section.items.map((item) => (
              <CommandItem
                key={item.id}
                value={`${item.title} ${section.title} ${(item.keywords ?? []).join(" ")}`}
                onSelect={() => go(item.href)}
              >
                <item.icon />
                {item.title}
                {item.shortcut ? (
                  <CommandShortcut>
                    <Kbd>G</Kbd>
                    <Kbd>{item.shortcut.toUpperCase()}</Kbd>
                  </CommandShortcut>
                ) : null}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}

        {actions.length ? (
          <CommandGroup heading="Create">
            {actions.map((action) => (
              <CommandItem
                key={action.id}
                value={`create ${action.title} ${action.keywords.join(" ")}`}
                onSelect={() => go(action.href)}
              >
                <Plus />
                {action.title}
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}

        <CommandSeparator />
        <CommandGroup heading="Preferences">
          <CommandItem value="theme light appearance" onSelect={() => run(() => setTheme("light"))}>
            <Sun /> Light theme
          </CommandItem>
          <CommandItem value="theme dark appearance" onSelect={() => run(() => setTheme("dark"))}>
            <Moon /> Dark theme
          </CommandItem>
          <CommandItem
            value="theme system appearance"
            onSelect={() => run(() => setTheme("system"))}
          >
            <Monitor /> System theme
          </CommandItem>
          <CommandItem value="toggle sidebar collapse" onSelect={() => run(toggleCollapsed)}>
            <PanelLeft /> Toggle sidebar
            <CommandShortcut>
              <Kbd>[</Kbd>
            </CommandShortcut>
          </CommandItem>
          <CommandItem
            value="keyboard shortcuts help"
            onSelect={() => run(() => setShortcutsOpen(true))}
          >
            <Keyboard /> Keyboard shortcuts
            <CommandShortcut>
              <Kbd>?</Kbd>
            </CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
