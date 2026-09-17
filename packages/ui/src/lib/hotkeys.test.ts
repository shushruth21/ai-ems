// @vitest-environment jsdom
import {
  createSequenceMatcher,
  formatChord,
  isEditableTarget,
  isApplePlatform,
  matchesChord,
  parseChord,
} from "./hotkeys";

const key = (
  k: string,
  mods: Partial<{ metaKey: boolean; ctrlKey: boolean; altKey: boolean; shiftKey: boolean }> = {},
) => ({
  key: k,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  ...mods,
});

describe("hotkeys", () => {
  it("detects Apple platforms", () => {
    expect(isApplePlatform("MacIntel")).toBe(true);
    expect(isApplePlatform("iPhone")).toBe(true);
    expect(isApplePlatform("Win32")).toBe(false);
  });

  it("parses chords", () => {
    expect(parseChord("mod+shift+K")).toEqual({ key: "k", mod: true, alt: false, shift: true });
    expect(parseChord("?")).toEqual({ key: "?", mod: false, alt: false, shift: undefined });
  });

  it("maps mod to ⌘ on Apple and Ctrl elsewhere", () => {
    expect(matchesChord(key("k", { metaKey: true }), "mod+k", true)).toBe(true);
    expect(matchesChord(key("k", { ctrlKey: true }), "mod+k", true)).toBe(false);
    expect(matchesChord(key("K", { ctrlKey: true }), "mod+k", false)).toBe(true);
    expect(matchesChord(key("k"), "mod+k", false)).toBe(false);
  });

  it("does not fire plain shortcuts with modifiers held", () => {
    expect(matchesChord(key("[", { ctrlKey: true }), "[", false)).toBe(false);
    expect(matchesChord(key("[", { altKey: true }), "[", false)).toBe(false);
    expect(matchesChord(key("?", { shiftKey: true }), "?", false)).toBe(true);
  });

  it("formats chords per platform", () => {
    expect(formatChord("mod+k", true)).toEqual(["⌘", "K"]);
    expect(formatChord("mod+shift+p", false)).toEqual(["Ctrl", "Shift", "P"]);
    expect(formatChord("g o", false)).toEqual(["G", "O"]);
    expect(formatChord("escape", false)).toEqual(["Esc"]);
  });

  it("matches sequences within the timeout", () => {
    const m = createSequenceMatcher(["g o", "g h"], 1000);
    expect(m.press("g", 0)).toBeNull();
    expect(m.pending).toBe("g");
    expect(m.press("o", 500)).toBe("g o");
    expect(m.pending).toBe("");
  });

  it("expires stale prefixes and restarts on a new prefix", () => {
    const m = createSequenceMatcher(() => ["g o"], 1000);
    m.press("g", 0);
    expect(m.press("o", 5000)).toBeNull();
    m.press("x", 6000);
    m.press("g", 6100);
    expect(m.press("o", 6200)).toBe("g o");
  });

  it("recognizes editable targets", () => {
    const input = document.createElement("input");
    const div = document.createElement("div");
    expect(isEditableTarget(input)).toBe(true);
    expect(isEditableTarget(div)).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });
});
