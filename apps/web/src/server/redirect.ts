import type { Route } from "next";
import { redirect } from "next/navigation";

/**
 * `redirect()` for paths assembled at runtime. Callers must pass a path that
 * was already validated (safeRedirectPath / withNext) or an external URL
 * returned by Supabase Auth.
 */
export function redirectTo(path: string): never {
  redirect(path as Route);
}
