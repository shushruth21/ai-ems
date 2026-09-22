/** Workspace URL slugs: `/<slug>/dashboard`. */
export const SLUG_MIN = 3;
export const SLUG_MAX = 40;
export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

/**
 * Top-level paths the app owns (and a few that would be confusing or
 * impersonation-prone). An organization can never use these as its slug.
 */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  "_next",
  "about",
  "account",
  "admin",
  "api",
  "app",
  "assets",
  "auth",
  "billing",
  "blog",
  "dashboard",
  "docs",
  "forgot-password",
  "help",
  "icon",
  "invite",
  "legal",
  "login",
  "logout",
  "new",
  "onboarding",
  "preview",
  "pricing",
  "privacy",
  "public",
  "reset-password",
  "robots",
  "security",
  "settings",
  "signin",
  "signout",
  "signup",
  "static",
  "status",
  "support",
  "system",
  "terms",
  "verify-email",
  "www",
]);

export type SlugProblem = "too_short" | "too_long" | "invalid" | "reserved";

export function checkSlug(slug: string): SlugProblem | null {
  if (slug.length < SLUG_MIN) return "too_short";
  if (slug.length > SLUG_MAX) return "too_long";
  if (!SLUG_PATTERN.test(slug) || slug.includes("--")) return "invalid";
  if (RESERVED_SLUGS.has(slug)) return "reserved";
  return null;
}

/** "Acme Studio (NYC)" → "acme-studio-nyc". Diacritics are folded; the result may still need checkSlug(). */
export function slugify(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX)
    .replace(/-+$/g, "");
}

/** Deterministic alternatives when a slug is taken: acme → acme-2, acme-3 … */
export function slugCandidates(base: string, count = 5): string[] {
  const out: string[] = [];
  for (let i = 2; out.length < count; i++) {
    const suffix = `-${i}`;
    out.push(`${base.slice(0, SLUG_MAX - suffix.length).replace(/-+$/g, "")}${suffix}`);
  }
  return out;
}
