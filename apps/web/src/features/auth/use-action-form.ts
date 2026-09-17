"use client";

import { useState, useTransition } from "react";
import type { FieldValues, Path, UseFormReturn } from "react-hook-form";

import type { ActionResult } from "@ai-ems/contracts/auth";

export interface FormFeedback {
  tone: "danger" | "success";
  message: string;
}

/**
 * Runs a server action for a React Hook Form form and maps its result back:
 * field errors onto fields, everything else into `feedback`. Actions that
 * redirect never resolve on the client, so `pending` stays true while the
 * browser navigates.
 */
export function useActionForm<TValues extends FieldValues, TOutput, TData = undefined>(
  form: UseFormReturn<TValues, unknown, TOutput>,
  action: (values: TOutput) => Promise<ActionResult<TData>>,
  options: { onSuccess?: (result: Extract<ActionResult<TData>, { ok: true }>) => void } = {},
) {
  const [feedback, setFeedback] = useState<FormFeedback | null>(null);
  const [pending, startTransition] = useTransition();

  const onSubmit = form.handleSubmit((values) => {
    setFeedback(null);
    startTransition(async () => {
      const result = await action(values);
      if (result.ok) {
        if (result.message) setFeedback({ tone: "success", message: result.message });
        options.onSuccess?.(result);
        return;
      }
      const names = Object.keys(form.getValues());
      let unmatched: string | undefined;
      for (const [name, message] of Object.entries(result.fieldErrors ?? {})) {
        if (!message) continue;
        if (names.includes(name)) {
          form.setError(name as Path<TValues>, { type: "server", message }, { shouldFocus: true });
        } else {
          unmatched ??= message;
        }
      }
      const message = result.formError ?? unmatched;
      if (message) setFeedback({ tone: "danger", message });
    });
  });

  return { onSubmit, pending, feedback, setFeedback };
}
