"use client";

import { useEffect, useRef } from "react";

import {
  createSequenceMatcher,
  isApplePlatform,
  isEditableTarget,
  matchesChord,
} from "../lib/hotkeys";

export interface HotkeyBinding {
  /** Chord ("mod+k") or sequence ("g o"). */
  keys: string;
  handler: (event: KeyboardEvent) => void;
  /** Fire even while typing in inputs (default: only for mod-chords). */
  allowInInputs?: boolean;
}

/**
 * Global keyboard shortcuts. Bindings are read through a ref, so callers may
 * pass a new array each render without re-subscribing.
 */
export function useHotkeys(bindings: readonly HotkeyBinding[], enabled = true): void {
  const ref = useRef(bindings);
  useEffect(() => {
    ref.current = bindings;
  });

  useEffect(() => {
    if (!enabled) return;
    const apple = isApplePlatform(navigator.platform);
    // Read sequences lazily so binding changes apply without re-subscribing.
    const matcher = createSequenceMatcher(() =>
      ref.current.filter((b) => b.keys.includes(" ")).map((b) => b.keys),
    );

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing) return;
      const editable = isEditableTarget(event.target);

      for (const binding of ref.current) {
        if (binding.keys.includes(" ")) continue;
        const isModChord = binding.keys.includes("mod+");
        if (editable && !isModChord && !binding.allowInInputs) continue;
        if (matchesChord(event, binding.keys, apple)) {
          event.preventDefault();
          binding.handler(event);
          matcher.reset();
          return;
        }
      }

      if (editable || event.metaKey || event.ctrlKey || event.altKey || event.key.length !== 1)
        return;
      const hit = matcher.press(event.key, performance.now());
      if (hit) {
        const binding = ref.current.find((b) => b.keys === hit);
        if (binding) {
          event.preventDefault();
          binding.handler(event);
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled]);
}
