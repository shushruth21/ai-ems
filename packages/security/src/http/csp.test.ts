import { buildCsp, createNonce } from "./csp";

describe("csp", () => {
  it("includes the nonce and locks down framing", () => {
    const csp = buildCsp({ nonce: "abc", isDev: false, supabaseUrl: "https://ref.supabase.co" });
    expect(csp).toContain("script-src 'self' 'nonce-abc' 'strict-dynamic'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("connect-src 'self' https://ref.supabase.co wss://ref.supabase.co");
    expect(csp).toContain("upgrade-insecure-requests");
    expect(csp).not.toContain("unsafe-eval");
  });

  it("allows eval only in development", () => {
    expect(buildCsp({ nonce: "n", isDev: true })).toContain("'unsafe-eval'");
  });

  it("creates unique nonces", () => {
    expect(createNonce()).not.toBe(createNonce());
  });
});
