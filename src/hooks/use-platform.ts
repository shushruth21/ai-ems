"use client";

import { useSyncExternalStore } from "react";

import { isApplePlatform } from "@/lib/hotkeys";

const noop = () => () => {};

/** True on macOS / iOS (⌘ as the primary modifier). SSR assumes non-Apple. */
export function useIsApple(): boolean {
  return useSyncExternalStore(
    noop,
    () => {
      const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
      return isApplePlatform(nav.userAgentData?.platform ?? nav.platform ?? "");
    },
    () => false,
  );
}
