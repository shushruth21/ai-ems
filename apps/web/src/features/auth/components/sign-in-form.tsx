"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { magicLinkSchema, signInSchema } from "@ai-ems/contracts/auth";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@ai-ems/ui/components/ui/tabs";

import { requestMagicLink, signInWithPassword } from "../actions";
import { useActionForm } from "@/lib/use-action-form";

import { FormFeedback } from "@/components/forms/form-feedback";
import { PasswordInput } from "./password-input";

export function SignInForm({
  next,
  magicLinkEnabled,
}: {
  next?: string;
  magicLinkEnabled: boolean;
}) {
  if (!magicLinkEnabled) return <PasswordSignIn next={next} />;
  return (
    <Tabs defaultValue="password">
      <TabsList variant="segmented" className="w-full" aria-label="Sign-in method">
        <TabsTrigger value="password" className="flex-1">
          With password
        </TabsTrigger>
        <TabsTrigger value="email-link" className="flex-1">
          With email link
        </TabsTrigger>
      </TabsList>
      <TabsContent value="password">
        <PasswordSignIn next={next} />
      </TabsContent>
      <TabsContent value="email-link">
        <MagicLinkSignIn next={next} />
      </TabsContent>
    </Tabs>
  );
}

function PasswordSignIn({ next }: { next?: string }) {
  const form = useForm<z.input<typeof signInSchema>, unknown, z.output<typeof signInSchema>>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "", next },
  });
  const { onSubmit, pending, feedback } = useActionForm(form, signInWithPassword);

  return (
    <Form {...form}>
      <form
        onSubmit={onSubmit}
        noValidate
        className="grid gap-4"
        aria-label="Sign in with password"
      >
        <FormFeedback feedback={feedback} />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  autoComplete="username"
                  inputMode="email"
                  autoFocus
                  {...field}
                />
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
              <div className="flex items-center justify-between">
                <FormLabel>Password</FormLabel>
                <Link
                  href="/forgot-password"
                  className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <FormControl>
                <PasswordInput autoComplete="current-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" loading={pending} className="w-full">
          Sign in
        </Button>
      </form>
    </Form>
  );
}

function MagicLinkSignIn({ next }: { next?: string }) {
  const form = useForm<z.input<typeof magicLinkSchema>, unknown, z.output<typeof magicLinkSchema>>({
    resolver: zodResolver(magicLinkSchema),
    defaultValues: { email: "", next },
  });
  const { onSubmit, pending, feedback } = useActionForm(form, requestMagicLink);

  return (
    <Form {...form}>
      <form
        onSubmit={onSubmit}
        noValidate
        className="grid gap-4"
        aria-label="Sign in with an email link"
      >
        <FormFeedback feedback={feedback} />
        <p className="text-sm text-muted-foreground">
          We&apos;ll email you a one-time link that signs you in. It expires after one hour.
        </p>
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" autoComplete="email" inputMode="email" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" loading={pending} className="w-full">
          Email me a sign-in link
        </Button>
      </form>
    </Form>
  );
}
