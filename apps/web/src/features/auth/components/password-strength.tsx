"use client";

import { useId } from "react";

import { assessPassword, PASSWORD_MIN_LENGTH } from "@ai-ems/contracts/password-policy";
import { Progress } from "@ai-ems/ui/components/ui/progress";

const TONES = ["danger", "danger", "warning", "success", "success"] as const;

/** Live strength meter; the server applies the same policy. */
export function PasswordStrength({
  password,
  context = [],
}: {
  password: string;
  context?: string[];
}) {
  const id = useId();
  if (!password) {
    return (
      <p className="text-sm text-muted-foreground">
        Use at least {PASSWORD_MIN_LENGTH} characters. A short phrase of unrelated words works well.
      </p>
    );
  }
  const result = assessPassword(password, context);
  return (
    <div className="grid gap-1.5" data-testid="password-strength">
      <Progress
        value={((result.strength + 1) / 5) * 100}
        tone={TONES[result.strength]}
        aria-labelledby={id}
      />
      <p id={id} className="text-sm text-muted-foreground" aria-live="polite">
        Strength: <span className="font-medium text-foreground">{result.label}</span>
        {result.problems[0] ? ` — ${result.problems[0]}` : null}
      </p>
    </div>
  );
}
