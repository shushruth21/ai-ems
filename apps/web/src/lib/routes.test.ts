import {
  decideRoute,
  isAuthPage,
  isPreviewEnabled,
  isPublicPath,
  redirectPathFromUrl,
  safeRedirectPath,
  withNext,
  type RouteRequest,
} from "./routes";

describe("routes", () => {
  it("classifies public paths", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/auth/confirm")).toBe(true);
    expect(isPublicPath("/api/webhooks/payments")).toBe(true);
    expect(isPublicPath("/demo/dashboard")).toBe(false);
    expect(isPublicPath("/reset-password")).toBe(false);
    expect(isAuthPage("/signup")).toBe(true);
    expect(isAuthPage("/login/mfa")).toBe(false);
  });

  it("blocks open redirects", () => {
    expect(safeRedirectPath("/demo/sales?tab=open")).toBe("/demo/sales?tab=open");
    expect(safeRedirectPath("https://evil.example")).toBe("/account");
    expect(safeRedirectPath("//evil.example")).toBe("/account");
    expect(safeRedirectPath("/\\evil.example")).toBe("/account");
    expect(safeRedirectPath("/ok\nSet-Cookie:x")).toBe("/account");
    expect(safeRedirectPath("/a/../b")).toBe("/b");
    expect(safeRedirectPath(null, "/x")).toBe("/x");
  });

  it("accepts absolute redirect URLs on the app origin only", () => {
    const app = "https://app.example";
    expect(redirectPathFromUrl("https://app.example/account?x=1", app)).toBe("/account?x=1");
    expect(redirectPathFromUrl("https://evil.example/account", app)).toBe("/account");
    expect(redirectPathFromUrl("/crm", app)).toBe("/crm");
    expect(redirectPathFromUrl("javascript:alert(1)", app)).toBe("/account");
    expect(redirectPathFromUrl(null, app, "/x")).toBe("/x");
  });

  it("builds next parameters", () => {
    expect(withNext("/login", "/crm?x=1")).toBe("/login?next=%2Fcrm%3Fx%3D1");
    expect(withNext("/login", "/account")).toBe("/login");
    expect(withNext("/login", "https://evil.example")).toBe("/login");
  });
});

describe("decideRoute", () => {
  const base: RouteRequest = {
    pathname: "/account",
    search: "",
    next: null,
    userId: null,
    mfaRequired: false,
    previewEnabled: false,
  };
  const decide = (over: Partial<RouteRequest>) => decideRoute({ ...base, ...over });

  it("sends anonymous visitors of private pages to login with next", () => {
    expect(decide({ pathname: "/crm/leads", search: "?q=a" })).toEqual({
      action: "redirect",
      to: "/login?next=%2Fcrm%2Fleads%3Fq%3Da",
    });
    expect(decide({ pathname: "/account" })).toEqual({ action: "redirect", to: "/login" });
    expect(decide({ pathname: "/login" })).toEqual({ action: "continue" });
    expect(decide({ pathname: "/login/mfa", next: "/crm" })).toEqual({
      action: "redirect",
      to: "/login?next=%2Fcrm",
    });
  });

  it("moves signed-in users off signed-out pages", () => {
    const user = { userId: "u1" };
    expect(decide({ ...user, pathname: "/login", next: "/crm" })).toEqual({
      action: "redirect",
      to: "/crm",
    });
    expect(decide({ ...user, pathname: "/signup" })).toEqual({
      action: "redirect",
      to: "/account",
    });
    expect(decide({ ...user, pathname: "/login/mfa" })).toEqual({
      action: "redirect",
      to: "/account",
    });
    expect(decide({ ...user, pathname: "/login", next: "https://evil.example" })).toEqual({
      action: "redirect",
      to: "/account",
    });
    expect(decide({ ...user, pathname: "/account" })).toEqual({ action: "continue" });
  });

  it("gates everything private behind MFA when a factor is pending", () => {
    const pending = { userId: "u1", mfaRequired: true };
    expect(decide({ ...pending, pathname: "/crm" })).toEqual({
      action: "redirect",
      to: "/login/mfa?next=%2Fcrm",
    });
    expect(decide({ ...pending, pathname: "/reset-password" })).toEqual({
      action: "redirect",
      to: "/login/mfa?next=%2Freset-password",
    });
    expect(decide({ ...pending, pathname: "/login", next: "/crm" })).toEqual({
      action: "redirect",
      to: "/login/mfa?next=%2Fcrm",
    });
    expect(decide({ ...pending, pathname: "/login/mfa" })).toEqual({ action: "continue" });
    expect(decide({ ...pending, pathname: "/auth/confirm" })).toEqual({ action: "continue" });
    expect(decide({ ...pending, pathname: "/" })).toEqual({ action: "continue" });
  });

  it("honours the preview sandbox flag", () => {
    expect(decide({ pathname: "/preview/demo/dashboard", previewEnabled: true })).toEqual({
      action: "continue",
    });
    expect(decide({ pathname: "/preview/demo/dashboard" }).action).toBe("redirect");
  });
});

describe("preview flag", () => {
  it("defaults on in development and off in production", () => {
    expect(isPreviewEnabled({ NODE_ENV: "development" })).toBe(true);
    expect(isPreviewEnabled({ NODE_ENV: "production" })).toBe(false);
    expect(isPreviewEnabled({ NODE_ENV: "production", ENABLE_UI_PREVIEW: "true" })).toBe(true);
    expect(isPreviewEnabled({ NODE_ENV: "development", ENABLE_UI_PREVIEW: "false" })).toBe(false);
  });

  it("treats /preview as public only when enabled", () => {
    expect(isPublicPath("/preview/demo/dashboard", true)).toBe(true);
    expect(isPublicPath("/preview/demo/dashboard", false)).toBe(false);
    expect(isPublicPath("/previewer", true)).toBe(false);
  });
});
