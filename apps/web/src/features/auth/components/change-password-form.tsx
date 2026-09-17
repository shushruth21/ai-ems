"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { changePasswordSchema } from "@ai-ems/contracts/auth";
import { Button } from "@ai-ems/ui/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@ai-ems/ui/components/ui/form";

import { changePassword } from "../actions";
import { useActionForm } from "../use-action-form";

import { FormFeedback } from "./form-feedback";
import { NewPasswordFields } from "./new-password-fields";
import { PasswordInput } from "./password-input";

export function ChangePasswordForm({
  email,
  hasPassword,
}: {
  email: string;
  hasPassword: boolean;
}) {
  const form = useForm<
    z.input<typeof changePasswordSchema>,
    unknown,
    z.output<typeof changePasswordSchema>
  >({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", password: "", confirmPassword: "" },
    mode: "onTouched",
  });
  const { onSubmit, pending, feedback } = useActionForm(form, changePassword, {
    onSuccess: () => form.reset(),
  });

  if (!hasPassword) {
    return (
      <p className="text-sm text-muted-foreground">
        You sign in with a connected account or email links. To add a password, use{" "}
        <a href="/forgot-password" className="underline underline-offset-4">
          reset password
        </a>
        .
      </p>
    );
  }

  return (
    <Form {...form}>
      <form
        onSubmit={onSubmit}
        noValidate
        className="grid max-w-md gap-4"
        aria-label="Change password"
      >
        <FormFeedback feedback={feedback} />
        <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
        <FormField
          control={form.control}
          name="currentPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Current password</FormLabel>
              <FormControl>
                <PasswordInput autoComplete="current-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <NewPasswordFields control={form.control} context={[email.split("@")[0] ?? ""]} />
        <div>
          <Button type="submit" loading={pending}>
            Update password
          </Button>
        </div>
      </form>
    </Form>
  );
}
