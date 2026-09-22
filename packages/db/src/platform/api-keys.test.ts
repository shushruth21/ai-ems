import { describe, expect, it } from "vitest";

import { hashApiKey, newApiKey, parseApiKey } from "./api-keys";

describe("API key tokens", () => {
  it("round-trips the public prefix out of a generated token", () => {
    for (let i = 0; i < 200; i++) {
      const { token, prefix, keyHash } = newApiKey();
      // The secret half is base64url and may contain "_" and "-": the parser
      // must not split the token on underscores.
      expect(parseApiKey(token)).toEqual({ prefix });
      expect(keyHash).toBe(hashApiKey(token));
      expect(keyHash).not.toContain(token);
    }
  });

  it("rejects anything that isn't one of our tokens", () => {
    const { token } = newApiKey();
    for (const bad of [
      "",
      "aiems",
      "aiems_short_secret",
      token.replace("aiems_", "other_"),
      `aiems_${"z".repeat(12)}_${"a".repeat(43)}`, // prefix isn't hex
      `aiems_${"0".repeat(12)}_short`,
      ` ${token}`,
    ]) {
      expect(parseApiKey(bad)).toBeNull();
    }
  });
});
