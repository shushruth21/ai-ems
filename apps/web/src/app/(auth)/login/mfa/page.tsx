import type { Metadata } from "next";

import { redirectTo } from "@/server/redirect";
import { signOut } from "@/features/auth/actions";
import { AuthCard } from "@/features/auth/components/auth-card";
import { MfaChallengeForm } from "@/features/auth/components/mfa-challenge-form";
import { firstParam } from "@/features/auth/messages";
import { safeRedirectPath } from "@/lib/routes";
import { requireSession } from "@/server/auth/session";
import { Button } from "@ai-ems/ui/components/ui/button";

export const metadata: Metadata = { title: "Two-factor authentication" };

export default async function MfaPage({ searchParams }: PageProps<"/login/mfa">) {
  const rawNext = firstParam((await searchParams).next);
  const next = rawNext ? safeRedirectPath(rawNext) : undefined;
  const user = await requireSession({ next, allowMfaPending: true });
  const factor = user.verifiedFactors[0];
  if (!user.mfaRequired || !factor) redirectTo(safeRedirectPath(next));

  return (
    <AuthCard
      title="Two-factor authentication"
      description={`Signed in as ${user.email}. One more step to keep your account safe.`}
      footer={
        <form action={signOut}>
          <Button type="submit" variant="link" size="sm">
            Use a different account
          </Button>
        </form>
      }
    >
      <MfaChallengeForm factorId={factor.id} next={next} />
    </AuthCard>
  );
}
