import { assessPassword, PASSWORD_MIN_LENGTH } from "./password-policy";

describe("password policy", () => {
  it("requires a minimum length", () => {
    const r = assessPassword("Short1!");
    expect(r.valid).toBe(false);
    expect(r.strength).toBe(0);
    expect(r.label).toBe("Too short");
    expect(r.problems[0]).toContain(String(PASSWORD_MIN_LENGTH));
  });

  it("rejects common, repeated and sequential passwords", () => {
    expect(assessPassword("password1234").problems).toContain("This password is too common.");
    expect(assessPassword("aaaaaaaaaaaaaa").valid).toBe(false);
    expect(assessPassword("abcabcabcabcabc").valid).toBe(false);
    expect(assessPassword("abcdefghijklm").valid).toBe(false);
    expect(assessPassword("1234567890123").valid).toBe(true); // not a pure sequence
  });

  it("rejects passwords containing personal context", () => {
    const r = assessPassword("riley-summer-garden", ["riley", "morgan"]);
    expect(r.valid).toBe(false);
    expect(r.problems).toContain("Don't include your name or email in your password.");
    expect(assessPassword("maple-summer-garden", ["jo"]).valid).toBe(true); // too-short context ignored
  });

  it("scores strength by length and variety", () => {
    expect(assessPassword("plainlowercase").strength).toBe(1);
    expect(assessPassword("plain lowercase7").strength).toBe(3);
    expect(assessPassword("Plain Lowercase7").strength).toBe(4);
    expect(assessPassword("correct horse battery staple").strength).toBe(4);
    expect(assessPassword("Correct Horse 9").label).toBe("Fair");
  });

  it("caps the score when there are problems", () => {
    const r = assessPassword("Password1234!!!!", ["password"]);
    expect(r.valid).toBe(false);
    expect(r.strength).toBeLessThanOrEqual(1);
  });

  it("rejects very long passwords", () => {
    expect(assessPassword("a1B!".repeat(40)).valid).toBe(false);
  });
});
