import { randomUUID } from "node:crypto";

import { expect, type Page } from "@playwright/test";

import { totp } from "../../../tools/auth-emulator/src/totp";

/** Test helpers backed by the auth emulator's /__ hooks. */
export const EMULATOR = `${process.env.AUTH_EMULATOR_URL ?? `http://127.0.0.1:${process.env.AUTH_EMULATOR_PORT ?? 54321}`}/auth/v1`;

export const PASSWORD = "Quiet-River-Lantern-42";

export function uniqueEmail(tag: string): string {
  return `${tag}.${randomUUID().slice(0, 8)}@example.test`;
}

/** Each test gets its own client IP so per-IP rate limits don't collide. */
export async function isolateClientIp(page: Page): Promise<string> {
  const bytes = randomUUID().replace(/\D/g, "").padEnd(6, "1");
  const ip = `198.51.${Number(bytes.slice(0, 3)) % 256}.${Number(bytes.slice(3, 6)) % 256}`;
  await page.setExtraHTTPHeaders({ "x-forwarded-for": ip });
  return ip;
}

export async function createUser(
  email: string,
  options: { password?: string; fullName?: string; totp?: boolean } = {},
): Promise<{ id: string; email: string; totpSecret?: string }> {
  const res = await fetch(`${EMULATOR}/__users`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email,
      password: options.password ?? PASSWORD,
      totp: options.totp ?? false,
      data: { full_name: options.fullName ?? "Test User" },
    }),
  });
  expect(res.ok, await res.clone().text()).toBe(true);
  return (await res.json()) as { id: string; email: string; totpSecret?: string };
}

interface SentEmail {
  to: string;
  kind: "signup" | "magiclink" | "recovery";
  tokenHash: string;
  type: string;
  redirectTo: string | null;
}

export async function latestEmail(to: string, kind?: SentEmail["kind"]): Promise<SentEmail> {
  let found: SentEmail | undefined;
  await expect
    .poll(async () => {
      const res = await fetch(`${EMULATOR}/__emails?to=${encodeURIComponent(to)}`);
      const all = ((await res.json()) as SentEmail[]).filter((e) => !kind || e.kind === kind);
      found = all.at(-1);
      return !!found;
    })
    .toBe(true);
  return found!;
}

/** The link our Supabase email templates produce (see supabase/templates). */
export function confirmLinkFor(email: SentEmail): string {
  const params = new URLSearchParams({ token_hash: email.tokenHash, type: email.type });
  if (email.redirectTo) params.set("next", email.redirectTo);
  return `/auth/confirm?${params}`;
}

export async function factorSecret(factorId: string): Promise<string> {
  const res = await fetch(`${EMULATOR}/__factors/${factorId}/secret`);
  return ((await res.json()) as { secret: string }).secret;
}

export function currentCode(secret: string): string {
  return totp(secret);
}

export async function signIn(page: Page, email: string, password = PASSWORD, next?: string) {
  await page.goto(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  await page.getByRole("textbox", { name: "Email" }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

export async function passMfa(page: Page, secret: string) {
  await expect(page).toHaveURL(/\/login\/mfa/);
  await page.getByRole("textbox", { name: "Authentication code" }).fill(currentCode(secret));
  await page.getByRole("button", { name: "Verify" }).click();
}
