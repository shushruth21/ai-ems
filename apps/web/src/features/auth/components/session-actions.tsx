import { LogOut } from "lucide-react";

import { Button } from "@ai-ems/ui/components/ui/button";

import { signOut, signOutEverywhere } from "../actions";

/** Plain forms posting to server actions: work without JavaScript. */
export function SessionActions() {
  return (
    <div className="flex flex-wrap gap-2">
      <form action={signOut}>
        <Button type="submit" variant="outline">
          <LogOut aria-hidden />
          Sign out
        </Button>
      </form>
      <form action={signOutEverywhere}>
        <Button type="submit" variant="danger">
          Sign out of all devices
        </Button>
      </form>
    </div>
  );
}
