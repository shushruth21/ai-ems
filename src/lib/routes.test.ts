import { isAuthPage, isPreviewEnabled, isPublicPath, safeRedirectPath } from "./routes";

describe("routes", () => {
  it("classifies public paths", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/api/webhooks/payments")).toBe(true);
    expect(isPublicPath("/demo/dashboard")).toBe(false);
    expect(isAuthPage("/signup")).toBe(true);
  });

  it("blocks open redirects", () => {
    expect(safeRedirectPath("/demo/sales")).toBe("/demo/sales");
    expect(safeRedirectPath("https://evil.example")).toBe("/onboarding");
    expect(safeRedirectPath("//evil.example")).toBe("/onboarding");
    expect(safeRedirectPath("/\\evil.example")).toBe("/onboarding");
    expect(safeRedirectPath(null, "/x")).toBe("/x");
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
