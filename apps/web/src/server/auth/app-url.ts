import "server-only";

import { publicEnv } from "@ai-ems/config/env";

/** Absolute URL on this app, used for Supabase email and OAuth redirects. */
export function appUrl(path = "/"): string {
  return new URL(path, publicEnv().NEXT_PUBLIC_APP_URL).toString();
}
