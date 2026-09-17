import { Button } from "@ai-ems/ui/components/ui/button";
import { Separator } from "@ai-ems/ui/components/ui/separator";

import { startOAuth } from "../actions";

const LABELS = { google: "Continue with Google", azure: "Continue with Microsoft" } as const;

/**
 * Plain HTML forms posting to a server action: they work before hydration
 * and without JavaScript. Provider names only — no third-party logos.
 */
export function OAuthButtons({
  providers,
  next,
}: {
  providers: Array<keyof typeof LABELS>;
  next?: string;
}) {
  if (providers.length === 0) return null;
  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-3 text-xs text-muted-foreground uppercase">
        <Separator className="flex-1" />
        or
        <Separator className="flex-1" />
      </div>
      {providers.map((provider) => (
        <form key={provider} action={startOAuth}>
          <input type="hidden" name="provider" value={provider} />
          {next ? <input type="hidden" name="next" value={next} /> : null}
          <Button type="submit" variant="outline" className="w-full">
            {LABELS[provider]}
          </Button>
        </form>
      ))}
    </div>
  );
}
