import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard } from "@/features/auth/components/auth-card";
import { SignUpForm } from "@/features/auth/components/sign-up-form";
import { firstParam } from "@/features/auth/messages";
import { safeRedirectPath, withNext } from "@/lib/routes";
import { isEnabled } from "@ai-ems/config/flags";

export const metadata: Metadata = { title: "Create account" };

export default async function SignUpPage({ searchParams }: PageProps<"/signup">) {
  const enabled = isEnabled("SIGN_UP");
  const rawNext = firstParam((await searchParams).next);
  const next = rawNext ? safeRedirectPath(rawNext) : undefined;
  return (
    <AuthCard
      title="Create your account"
      description={
        enabled ? "Start with your own workspace. You can invite your team later." : undefined
      }
      footer={
        <>
          Already have an account?{" "}
          <Link
            href={withNext("/login", next) as "/login"}
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </>
      }
    >
      {enabled ? (
        <SignUpForm next={next} />
      ) : (
        <p className="text-sm text-muted-foreground">
          New sign-ups are closed. Ask your administrator for an invitation.
        </p>
      )}
    </AuthCard>
  );
}
