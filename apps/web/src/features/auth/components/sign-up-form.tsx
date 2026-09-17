"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useForm, useWatch } from "react-hook-form";
import type { z } from "zod";

import { signUpSchema } from "@ai-ems/contracts/auth";
import { Button } from "@ai-ems/ui/components/ui/button";
import { Checkbox } from "@ai-ems/ui/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@ai-ems/ui/components/ui/form";
import { Input } from "@ai-ems/ui/components/ui/input";

import { signUp } from "../actions";
import { useActionForm } from "../use-action-form";

import { FormFeedback } from "./form-feedback";
import { PasswordInput } from "./password-input";
import { PasswordStrength } from "./password-strength";

type Input = z.input<typeof signUpSchema>;

export function SignUpForm() {
  const form = useForm<Input, unknown, z.output<typeof signUpSchema>>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { fullName: "", email: "", password: "", acceptTerms: false },
    mode: "onTouched",
  });
  const { onSubmit, pending, feedback } = useActionForm(form, signUp);
  const [password = "", email = "", fullName = ""] = useWatch({
    control: form.control,
    name: ["password", "email", "fullName"],
  });

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} noValidate className="grid gap-4" aria-label="Create account">
        <FormFeedback feedback={feedback} />
        <FormField
          control={form.control}
          name="fullName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Full name</FormLabel>
              <FormControl>
                <Input autoComplete="name" autoFocus {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Work email</FormLabel>
              <FormControl>
                <Input type="email" autoComplete="email" inputMode="email" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <PasswordInput autoComplete="new-password" {...field} />
              </FormControl>
              <PasswordStrength
                password={password}
                context={[email.split("@")[0] ?? "", ...fullName.split(/\s+/)]}
              />
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="acceptTerms"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-start gap-2">
                <FormControl>
                  <Checkbox
                    checked={field.value === true}
                    onCheckedChange={(v) => field.onChange(v === true)}
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                  />
                </FormControl>
                <FormLabel className="leading-snug font-normal">
                  I agree to the{" "}
                  <Link href="/legal/terms" className="underline underline-offset-4">
                    Terms
                  </Link>{" "}
                  and{" "}
                  <Link href="/legal/privacy" className="underline underline-offset-4">
                    Privacy Policy
                  </Link>
                </FormLabel>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" loading={pending} className="w-full">
          Create account
        </Button>
      </form>
    </Form>
  );
}
