# Acceptance criteria (definition of done)

A module or phase is done when all of the following hold:

1. **Functional:** every user story in the phase has Given/When/Then criteria, covered by automated tests.
2. **Security:**
   - Every server action validates input (Zod), calls `authorize()` and uses `getTenantDb()`.
   - Any new client-reachable table has RLS and an integration test.
3. **Quality:**
   - `pnpm check` is green.
   - Domain code has at least 90% line coverage.
   - There are no `any` types, no disabled lint rules in app code, and no console errors.
4. **UX:**
   - Pages work at 390 px and 1440 px, with no horizontal page scroll.
   - The UI works in light and dark mode.
   - Everything is keyboard-operable.
   - axe finds no serious or critical issues.
5. **Operations:**
   - Migrations are included and reversible where possible.
   - Runbooks are updated.
   - Health checks cover any new dependency.
6. **Docs:** the phase doc covers the 12 sections. ADRs are added for new decisions.

## Phase 3: Authentication stories

| Story          | Given / When / Then                                                                                                                              |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Sign in        | Given a verified account, when I submit a valid email and password, then I land on my intended page (or `/account`), with a session cookie set   |
| Wrong password | Given any account, when the password is wrong, then I see a generic error that doesn't reveal whether the email exists                           |
| Rate limit     | Given 10 attempts in 10 minutes for one email (or 30 from one IP), then further attempts are refused with a "too many attempts" message          |
| Magic link     | When I request a link, then I see "check your email" whether or not the account exists                                                           |
| Sign up        | When I sign up with a strong password, then I'm asked to verify my email. Weak passwords are rejected with guidance.                             |
| Reset          | When I request a reset, the response doesn't reveal the account. The link lets me set a new password once, and my other sessions are signed out. |
| MFA            | Given enrolled TOTP, after my password I must enter a valid 6-digit code before reaching any app page                                            |
| Sign out       | When I sign out, then my session is cleared and protected pages redirect to sign-in                                                              |
| Open redirect  | Given `?next=https://evil.example`, after sign-in I land on `/account`                                                                           |
