"use client";

import { useState, useTransition } from "react";

import { FormFeedback } from "@/components/forms/form-feedback";
import type { FormFeedback as Feedback } from "@/lib/use-action-form";
import { Label } from "@ai-ems/ui/components/ui/label";
import { Switch } from "@ai-ems/ui/components/ui/switch";

import { updateSecurityPolicy } from "../actions";

export function SecuritySettings({
  slug,
  requireMfa,
  disabled,
}: {
  slug: string;
  requireMfa: boolean;
  disabled: boolean;
}) {
  const [checked, setChecked] = useState(requireMfa);
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  return (
    <div className="grid gap-4">
      <FormFeedback feedback={feedback} />
      <div className="flex items-start gap-3">
        <Switch
          id="require-mfa"
          checked={checked}
          disabled={disabled || pending}
          onCheckedChange={(next) => {
            setChecked(next);
            setFeedback(null);
            startTransition(async () => {
              const result = await updateSecurityPolicy(slug, { requireMfa: next });
              if (result.ok) {
                setFeedback(result.message ? { tone: "success", message: result.message } : null);
              } else {
                setChecked(!next);
                setFeedback({
                  tone: "danger",
                  message: result.formError ?? "Couldn't change the policy.",
                });
              }
            });
          }}
        />
        <div className="grid gap-1">
          <Label htmlFor="require-mfa">Require two-factor authentication</Label>
          <p className="text-sm text-muted-foreground">
            Members must complete an authenticator code before they can open this workspace.
            Enforced in the app and in the database.
          </p>
        </div>
      </div>
    </div>
  );
}
