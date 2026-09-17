import { isAuthPage, isPublicPath, safeRedirectPath } from "./routes";

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
