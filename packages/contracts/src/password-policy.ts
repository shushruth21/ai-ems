/**
 * Password policy (NIST SP 800-63B aligned): length over composition rules,
 * block well-known and context-derived passwords. Pure and shared by the
 * browser (live feedback) and the server (authoritative check).
 */
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

/** A small deny-list of the most common passwords (full check is server-side at Supabase). */
const COMMON = new Set([
  "password",
  "password1",
  "password12",
  "password123",
  "password1234",
  "passw0rd",
  "123456789012",
  "1234567890",
  "qwertyuiop",
  "qwerty123456",
  "letmein12345",
  "iloveyou1234",
  "welcome12345",
  "admin1234567",
  "changeme1234",
  "abc123456789",
  "aaaaaaaaaaaa",
  "111111111111",
  "000000000000",
  "trustno1trustno1",
]);

export type PasswordStrength = 0 | 1 | 2 | 3 | 4;

export interface PasswordAssessment {
  valid: boolean;
  strength: PasswordStrength;
  label: "Too short" | "Weak" | "Fair" | "Good" | "Strong";
  problems: string[];
}

function characterClasses(pw: string): number {
  return [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(pw)).length;
}

function isRepetitive(pw: string): boolean {
  if (/^(.)\1+$/.test(pw)) return true;
  // repeated short chunk, e.g. "abcabcabcabc"
  for (let size = 1; size <= 4; size++) {
    const chunk = pw.slice(0, size);
    if (chunk.repeat(Math.ceil(pw.length / size)).slice(0, pw.length) === pw) return true;
  }
  return false;
}

function isSequential(pw: string): boolean {
  const lower = pw.toLowerCase();
  const sequences = ["abcdefghijklmnopqrstuvwxyz", "0123456789", "qwertyuiopasdfghjklzxcvbnm"];
  return sequences.some(
    (seq) => seq.includes(lower) || [...seq].reverse().join("").includes(lower),
  );
}

/**
 * @param context words that must not appear in the password (email local part, name, company).
 */
export function assessPassword(
  password: string,
  context: readonly string[] = [],
): PasswordAssessment {
  const problems: string[] = [];
  const pw = password;

  if (pw.length < PASSWORD_MIN_LENGTH)
    problems.push(`Use at least ${PASSWORD_MIN_LENGTH} characters.`);
  if (pw.length > PASSWORD_MAX_LENGTH)
    problems.push(`Use at most ${PASSWORD_MAX_LENGTH} characters.`);
  if (COMMON.has(pw.toLowerCase())) problems.push("This password is too common.");
  if (pw.length >= 4 && (isRepetitive(pw) || isSequential(pw)))
    problems.push("Avoid repeated or sequential characters.");
  const lowered = pw.toLowerCase();
  for (const word of context) {
    const w = word.trim().toLowerCase();
    if (w.length >= 3 && lowered.includes(w)) {
      problems.push("Don't include your name or email in your password.");
      break;
    }
  }

  const classes = characterClasses(pw);
  let score = 0;
  if (pw.length >= PASSWORD_MIN_LENGTH) score = 1;
  if (pw.length >= 14 && classes >= 2) score = 2;
  if (pw.length >= 16 && classes >= 3) score = 3;
  if ((pw.length >= 20 && classes >= 2) || (pw.length >= 16 && classes === 4)) score = 4;
  if (problems.length) score = Math.min(score, 1);

  const valid = problems.length === 0;
  const strength = (pw.length < PASSWORD_MIN_LENGTH ? 0 : score) as PasswordStrength;
  const labels = ["Too short", "Weak", "Fair", "Good", "Strong"] as const;
  return { valid, strength, label: labels[strength], problems };
}
