import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard } from "@/features/auth/components/auth-card";
import { FormFeedback } from "@/features/auth/components/form-feedback";
import { OAuthButtons } from "@/features/auth/components/oauth-buttons";
import { SignInForm } from "@/features/auth/components/sign-in-form";
import { firstParam, queryMessage } from "@/features/auth/messages";
import { safeRedirectPath, withNext } from "@/lib/routes";
import { resolveFlags } from "@ai-ems/config/flags";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const rawNext = firstParam(params.next);
  const next = rawNext ? safeRedirectPath(rawNext) : undefined;
  const flags = resolveFlags();
  const providers = [
    ...(flags.OAUTH_GOOGLE ? (["google"] as const) : []),
    ...(flags.OAUTH_MICROSOFT ? (["azure"] as const) : []),
  ];

  return (
    <AuthCard
      title="Sign in to AI EMS"
      description="Welcome back. Use your work email to continue."
      footer={
        flags.SIGN_UP ? (
          <>
            New here?{" "}
            <Link
              href={withNext("/signup", next) as "/signup"}
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Create an account
            </Link>
          </>
        ) : null
      }
    >
      <FormFeedback feedback={queryMessage(params)} />
      <SignInForm next={next} magicLinkEnabled={flags.MAGIC_LINK} />
      <OAuthButtons providers={providers} next={next} />
    </AuthCard>
  );
}
