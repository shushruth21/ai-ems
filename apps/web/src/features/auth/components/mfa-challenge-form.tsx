"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { mfaVerifySchema } from "@ai-ems/contracts/auth";
import { Button } from "@ai-ems/ui/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@ai-ems/ui/components/ui/form";

import { verifyMfa } from "../actions";
import { useActionForm } from "@/lib/use-action-form";

import { FormFeedback } from "@/components/forms/form-feedback";
import { OtpInput } from "./otp-input";

export function MfaChallengeForm({ factorId, next }: { factorId: string; next?: string }) {
  const form = useForm<z.input<typeof mfaVerifySchema>, unknown, z.output<typeof mfaVerifySchema>>({
    resolver: zodResolver(mfaVerifySchema),
    defaultValues: { factorId, code: "", next },
  });
  const { onSubmit, pending, feedback } = useActionForm(form, verifyMfa);

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} noValidate className="grid gap-4" aria-label="Verify sign-in">
        <FormFeedback feedback={feedback} />
        <FormField
          control={form.control}
          name="code"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Authentication code</FormLabel>
              <FormControl>
                <OtpInput autoFocus {...field} />
              </FormControl>
              <FormDescription>
                Open your authenticator app and enter the 6-digit code.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" loading={pending} className="w-full">
          Verify
        </Button>
      </form>
    </Form>
  );
}
