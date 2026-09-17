"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@ai-ems/ui/components/ui/dialog";
import { Kbd, KbdGroup } from "@ai-ems/ui/components/ui/kbd";
import { navigationShortcuts } from "@/config/navigation";
import { useIsApple } from "@ai-ems/ui/hooks/use-platform";
import { formatChord } from "@ai-ems/ui/lib/hotkeys";

import { useShell } from "./shell-context";

export const GLOBAL_SHORTCUTS = [
  { keys: "mod+k", label: "Open command palette" },
  { keys: "/", label: "Search" },
  { keys: "[", label: "Toggle sidebar" },
  { keys: "?", label: "Show keyboard shortcuts" },
] as const;

function Keys({ chord, apple }: { chord: string; apple: boolean }) {
  return (
    <KbdGroup>
      {formatChord(chord, apple).map((k, i) => (
        <Kbd key={`${k}-${i}`}>{k}</Kbd>
      ))}
    </KbdGroup>
  );
}

export function ShortcutsDialog() {
  const { shortcutsOpen, setShortcutsOpen, navigation } = useShell();
  const apple = useIsApple();
  const nav = navigationShortcuts(navigation);

  return (
    <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>Work faster without leaving the keyboard.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-5">
          <section>
            <h3 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              General
            </h3>
            <dl className="grid gap-1.5">
              {GLOBAL_SHORTCUTS.map((s) => (
                <div key={s.keys} className="flex items-center justify-between gap-4">
                  <dt>{s.label}</dt>
                  <dd>
                    <Keys chord={s.keys} apple={apple} />
                  </dd>
                </div>
              ))}
            </dl>
          </section>
          {nav.length ? (
            <section>
              <h3 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Go to
              </h3>
              <dl className="grid gap-1.5">
                {nav.map(({ keys, item }) => (
                  <div key={keys} className="flex items-center justify-between gap-4">
                    <dt>{item.title}</dt>
                    <dd>
                      <Keys chord={keys} apple={apple} />
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
