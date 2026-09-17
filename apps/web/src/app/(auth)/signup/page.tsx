import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard } from "@/features/auth/components/auth-card";
import { SignUpForm } from "@/features/auth/components/sign-up-form";
import { isEnabled } from "@ai-ems/config/flags";

export const metadata: Metadata = { title: "Create account" };

export default function SignUpPage() {
  const enabled = isEnabled("SIGN_UP");
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
            href="/login"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </>
      }
    >
      {enabled ? (
        <SignUpForm />
      ) : (
        <p className="text-sm text-muted-foreground">
          New sign-ups are closed. Ask your administrator for an invitation.
        </p>
      )}
    </AuthCard>
  );
}
