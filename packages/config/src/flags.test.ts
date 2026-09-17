import { FLAG_DEFAULTS, isEnabled, resolveFlags } from "./flags";

describe("feature flags", () => {
  it("uses defaults when unset", () => {
    expect(resolveFlags({})).toEqual(FLAG_DEFAULTS);
  });

  it("applies overrides", () => {
    const flags = resolveFlags({
      FEATURE_OAUTH_GOOGLE: "true",
      FEATURE_MAGIC_LINK: "off",
      FEATURE_SIGN_UP: "",
    });
    expect(flags.OAUTH_GOOGLE).toBe(true);
    expect(flags.MAGIC_LINK).toBe(false);
    expect(flags.SIGN_UP).toBe(FLAG_DEFAULTS.SIGN_UP);
    expect(isEnabled("OAUTH_GOOGLE", { FEATURE_OAUTH_GOOGLE: "1" })).toBe(true);
  });

  it("rejects ambiguous values", () => {
    expect(() => resolveFlags({ FEATURE_MFA_TOTP: "maybe" })).toThrow(/Invalid boolean/);
  });
});
