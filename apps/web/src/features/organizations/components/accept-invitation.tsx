"use client";

import { useState, useTransition } from "react";

import { FormFeedback } from "@/components/forms/form-feedback";
import type { FormFeedback as Feedback } from "@/lib/use-action-form";
import { Button } from "@ai-ems/ui/components/ui/button";

import { acceptInvitation } from "../actions";

export function AcceptInvitation({
  token,
  organizationName,
}: {
  token: string;
  organizationName: string;
}) {
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  return (
    <div className="grid gap-4">
      <FormFeedback feedback={feedback} />
      <Button
        className="w-full"
        loading={pending}
        onClick={() =>
          startTransition(async () => {
            setFeedback(null);
            const result = await acceptInvitation(token);
            if (!result.ok)
              setFeedback({ tone: "danger", message: result.formError ?? "Couldn't accept." });
          })
        }
      >
        Join {organizationName}
      </Button>
    </div>
  );
}
