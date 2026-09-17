import type { AuthEventType, AuthEventView } from "@ai-ems/db/auth/auth-events";

const LABELS: Record<AuthEventType, string> = {
  SIGN_IN_SUCCEEDED: "Signed in",
  SIGN_IN_FAILED: "Failed sign-in attempt",
  SIGN_UP: "Account created",
  MAGIC_LINK_REQUESTED: "Sign-in link requested",
  PASSWORD_RESET_REQUESTED: "Password reset requested",
  PASSWORD_CHANGED: "Password changed",
  EMAIL_VERIFIED: "Email verified",
  OAUTH_STARTED: "Connected-account sign-in started",
  OAUTH_SUCCEEDED: "Signed in with a connected account",
  MFA_ENROLLED: "Two-factor authentication turned on",
  MFA_VERIFIED: "Two-factor check passed",
  MFA_FAILED: "Two-factor check failed",
  MFA_REMOVED: "Two-factor authentication turned off",
  SIGNED_OUT: "Signed out",
  SIGNED_OUT_EVERYWHERE: "Signed out of all devices",
  RATE_LIMITED: "Too many attempts blocked",
};

const WARN = new Set<AuthEventType>([
  "SIGN_IN_FAILED",
  "MFA_FAILED",
  "MFA_REMOVED",
  "RATE_LIMITED",
]);

export function SecurityActivity({ events }: { events: AuthEventView[] | null }) {
  if (events === null) {
    return (
      <p className="text-sm text-muted-foreground">Security activity is temporarily unavailable.</p>
    );
  }
  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">No recent activity.</p>;
  }
  const fmt = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });
  return (
    <ul className="divide-y rounded-md border" aria-label="Recent security activity">
      {events.map((e) => (
        <li
          key={e.id}
          className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-3 py-2"
        >
          <span className={WARN.has(e.type) ? "font-medium text-danger" : "font-medium"}>
            {LABELS[e.type]}
          </span>
          <span className="text-sm text-muted-foreground tabular-nums">
            <time dateTime={e.createdAt.toISOString()}>{fmt.format(e.createdAt)}</time>
            {e.ip && e.ip !== "unknown" ? ` · ${e.ip}` : null}
          </span>
        </li>
      ))}
    </ul>
  );
}
