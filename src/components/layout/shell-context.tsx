"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import { filterNavigation, NAVIGATION, type NavSection } from "@/config/navigation";
import { SIDEBAR_COOKIE } from "@/config/shell";
import type { Permission } from "@/server/auth/permissions";
import type { ShellContextValue } from "@/types/shell";

interface ShellState extends ShellContextValue {
  navigation: NavSection[];
  can: (permission: Permission) => boolean;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  toggleCollapsed: () => void;
  mobileNavOpen: boolean;
  setMobileNavOpen: (open: boolean) => void;
  commandOpen: boolean;
  setCommandOpen: (open: boolean) => void;
  shortcutsOpen: boolean;
  setShortcutsOpen: (open: boolean) => void;
}

const ShellContext = createContext<ShellState | null>(null);

function persistCollapsed(collapsed: boolean) {
  document.cookie = `${SIDEBAR_COOKIE}=${collapsed ? "collapsed" : "expanded"}; path=/; max-age=31536000; samesite=lax`;
}

export function ShellProvider({
  value,
  defaultCollapsed = false,
  children,
}: {
  value: ShellContextValue;
  defaultCollapsed?: boolean;
  children: ReactNode;
}) {
  const [collapsed, setCollapsedState] = useState(defaultCollapsed);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const setCollapsed = useCallback((next: boolean) => {
    setCollapsedState(next);
    persistCollapsed(next);
  }, []);
  const toggleCollapsed = useCallback(() => {
    setCollapsedState((prev) => {
      persistCollapsed(!prev);
      return !prev;
    });
  }, []);

  const permissionSet = useMemo(() => new Set<string>(value.permissions), [value.permissions]);
  const navigation = useMemo(() => filterNavigation(NAVIGATION, permissionSet), [permissionSet]);
  const can = useCallback((p: Permission) => permissionSet.has(p), [permissionSet]);

  const state = useMemo<ShellState>(
    () => ({
      ...value,
      navigation,
      can,
      collapsed,
      setCollapsed,
      toggleCollapsed,
      mobileNavOpen,
      setMobileNavOpen,
      commandOpen,
      setCommandOpen,
      shortcutsOpen,
      setShortcutsOpen,
    }),
    [
      value,
      navigation,
      can,
      collapsed,
      setCollapsed,
      toggleCollapsed,
      mobileNavOpen,
      commandOpen,
      shortcutsOpen,
    ],
  );

  return <ShellContext.Provider value={state}>{children}</ShellContext.Provider>;
}

export function useShell(): ShellState {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error("useShell must be used inside <ShellProvider>");
  return ctx;
}
