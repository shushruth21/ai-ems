"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { resetPasswordSchema } from "@ai-ems/contracts/auth";
import { Button } from "@ai-ems/ui/components/ui/button";
import { Form } from "@ai-ems/ui/components/ui/form";

import { completePasswordReset } from "../actions";
import { useActionForm } from "../use-action-form";

import { FormFeedback } from "./form-feedback";
import { NewPasswordFields } from "./new-password-fields";

export function ResetPasswordForm({ email }: { email: string }) {
  const form = useForm<
    z.input<typeof resetPasswordSchema>,
    unknown,
    z.output<typeof resetPasswordSchema>
  >({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
    mode: "onTouched",
  });
  const { onSubmit, pending, feedback } = useActionForm(form, completePasswordReset);

  return (
    <Form {...form}>
      <form
        onSubmit={onSubmit}
        noValidate
        className="grid gap-4"
        aria-label="Choose a new password"
      >
        <FormFeedback feedback={feedback} />
        {/* Helps password managers attach the new password to the right account. */}
        <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
        <NewPasswordFields control={form.control} context={[email.split("@")[0] ?? ""]} autoFocus />
        <Button type="submit" loading={pending} className="w-full">
          Update password
        </Button>
      </form>
    </Form>
  );
}
