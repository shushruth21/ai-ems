"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { forgotPasswordSchema } from "@ai-ems/contracts/auth";
import { Button } from "@ai-ems/ui/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@ai-ems/ui/components/ui/form";
import { Input } from "@ai-ems/ui/components/ui/input";

import { requestPasswordReset } from "../actions";
import { useActionForm } from "../use-action-form";

import { FormFeedback } from "./form-feedback";

export function ForgotPasswordForm() {
  const form = useForm<
    z.input<typeof forgotPasswordSchema>,
    unknown,
    z.output<typeof forgotPasswordSchema>
  >({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });
  const { onSubmit, pending, feedback } = useActionForm(form, requestPasswordReset, {
    onSuccess: () => form.reset(),
  });

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} noValidate className="grid gap-4" aria-label="Reset password">
        <FormFeedback feedback={feedback} />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" autoComplete="email" inputMode="email" autoFocus {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" loading={pending} className="w-full">
          Send reset link
        </Button>
      </form>
    </Form>
  );
}
