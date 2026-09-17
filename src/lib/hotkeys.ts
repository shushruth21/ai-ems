/**
 * Keyboard shortcut parsing — framework-free so it can be unit-tested.
 *
 * Chord syntax: "mod+k", "shift+?", "[", "escape". `mod` is ⌘ on Apple
 * platforms and Ctrl elsewhere. Sequences are space-separated chords: "g o".
 */
export interface KeyLike {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}

export function isApplePlatform(platform: string): boolean {
  return /mac|iphone|ipad|ipod/i.test(platform);
}

interface ParsedChord {
  key: string;
  mod: boolean;
  alt: boolean;
  shift: boolean | undefined;
}

export function parseChord(chord: string): ParsedChord {
  const parts = chord.toLowerCase().split("+");
  const key = parts.pop() ?? "";
  return {
    key,
    mod: parts.includes("mod"),
    alt: parts.includes("alt"),
    // Only enforce shift when explicitly written; "?" already implies it.
    shift: parts.includes("shift") ? true : undefined,
  };
}

export function matchesChord(event: KeyLike, chord: string, apple: boolean): boolean {
  const c = parseChord(chord);
  const modPressed = apple ? event.metaKey : event.ctrlKey;
  const otherMod = apple ? event.ctrlKey : event.metaKey;
  if (c.mod !== modPressed || otherMod) return false;
  if (c.alt !== event.altKey) return false;
  if (c.shift !== undefined && c.shift !== event.shiftKey) return false;
  return event.key.toLowerCase() === c.key;
}

export function formatChord(chord: string, apple: boolean): string[] {
  return chord.split(" ").flatMap((part) =>
    part.split("+").map((token) => {
      switch (token.toLowerCase()) {
        case "mod":
          return apple ? "⌘" : "Ctrl";
        case "shift":
          return apple ? "⇧" : "Shift";
        case "alt":
          return apple ? "⌥" : "Alt";
        case "escape":
          return "Esc";
        default:
          return token.length === 1 ? token.toUpperCase() : token;
      }
    }),
  );
}

/** True when the event originated in a text-editing context. */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || typeof (target as HTMLElement).closest !== "function") return false;
  const el = target as HTMLElement;
  if (el.isContentEditable) return true;
  return Boolean(
    el.closest(
      "input, textarea, select, [contenteditable=''], [contenteditable='true'], [role='combobox']",
    ),
  );
}

/**
 * Tracks multi-key sequences ("g o"). Feed it plain key presses; it returns the
 * matched sequence or null. Pending prefixes expire after `timeoutMs`.
 */
export function createSequenceMatcher(
  source: readonly string[] | (() => readonly string[]),
  timeoutMs = 1200,
) {
  let buffer: string[] = [];
  let lastAt = 0;
  return {
    press(key: string, now: number): string | null {
      const sequences = typeof source === "function" ? source() : source;
      if (now - lastAt > timeoutMs) buffer = [];
      lastAt = now;
      buffer.push(key.toLowerCase());
      const current = buffer.join(" ");
      const exact = sequences.find((s) => s === current);
      if (exact) {
        buffer = [];
        return exact;
      }
      if (!sequences.some((s) => s.startsWith(`${current} `))) {
        buffer = sequences.some((s) => s.startsWith(`${key.toLowerCase()} `))
          ? [key.toLowerCase()]
          : [];
      }
      return null;
    },
    reset() {
      buffer = [];
    },
    get pending(): string {
      return buffer.join(" ");
    },
  };
}
