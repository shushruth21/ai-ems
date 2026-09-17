"use client";

import { useState, useTransition } from "react";

import type { z } from "zod";

import type { confirmLinkSchema } from "@ai-ems/contracts/auth";
import { Button } from "@ai-ems/ui/components/ui/button";

import { confirmEmailLink } from "../actions";
import type { FormFeedback as Feedback } from "../use-action-form";

import { FormFeedback } from "./form-feedback";

const LABELS: Record<string, string> = {
  recovery: "Continue to reset your password",
  magiclink: "Sign in",
  signup: "Confirm email and sign in",
  email: "Continue",
  invite: "Accept invitation",
  email_change: "Confirm new email",
};

/**
 * Email links land here and require one click: link scanners in mail
 * gateways fetch URLs but don't submit forms, so tokens aren't burned early.
 */
export function ConfirmLinkForm(props: z.input<typeof confirmLinkSchema>) {
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setFeedback(null);
        startTransition(async () => {
          const result = await confirmEmailLink(props);
          if (!result.ok) {
            setFeedback({
              tone: "danger",
              message:
                result.formError ??
                Object.values(result.fieldErrors ?? {})[0] ??
                "This link is invalid or has expired.",
            });
          }
        });
      }}
    >
      <FormFeedback feedback={feedback} />
      <Button type="submit" loading={pending} className="w-full" autoFocus>
        {LABELS[props.type] ?? "Continue"}
      </Button>
    </form>
  );
}
