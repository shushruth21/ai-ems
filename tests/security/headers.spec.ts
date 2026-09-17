import { expect, test } from "@playwright/test";

test.describe("security headers", () => {
  test("pages send a strict CSP and hardening headers", async ({ request }) => {
    const res = await request.get("/");
    const h = res.headers();
    const csp = h["content-security-policy"] ?? "";
    expect(csp).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["strict-transport-security"]).toContain("max-age=");
    expect(h["x-powered-by"]).toBeUndefined();
  });

  test("each response gets a fresh nonce", async ({ request }) => {
    const nonce = async () =>
      /nonce-([^']+)/.exec(
        (await request.get("/")).headers()["content-security-policy"] ?? "",
      )?.[1];
    expect(await nonce()).not.toEqual(await nonce());
  });

  test("health endpoint is not cacheable", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.headers()["cache-control"]).toContain("no-store");
  });
});
