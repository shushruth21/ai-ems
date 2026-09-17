import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard } from "@/features/auth/components/auth-card";
import { ConfirmLinkForm } from "@/features/auth/components/confirm-link-form";
import { firstParam } from "@/features/auth/messages";
import { redirectPathFromUrl } from "@/lib/routes";
import { confirmLinkSchema } from "@ai-ems/contracts/auth";
import { publicEnv } from "@ai-ems/config/env";

export const metadata: Metadata = { title: "Confirm", referrer: "no-referrer" };

/**
 * Landing page for Supabase email links:
 *   /auth/confirm?token_hash=…&type=signup|magiclink|recovery|email|…&next=…
 * `next` may be an absolute URL (the template's {{ .RedirectTo }}) on our origin.
 */
export default async function ConfirmPage({ searchParams }: PageProps<"/auth/confirm">) {
  const params = await searchParams;
  const next = redirectPathFromUrl(firstParam(params.next), publicEnv().NEXT_PUBLIC_APP_URL);
  const parsed = confirmLinkSchema.safeParse({
    tokenHash: firstParam(params.token_hash),
    type: firstParam(params.type),
    next,
  });

  if (!parsed.success) {
    return (
      <AuthCard
        title="This link doesn't work"
        description="It may be incomplete, already used or expired."
        footer={
          <Link
            href="/login"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Back to sign in
          </Link>
        }
      >
        <p className="text-sm text-muted-foreground">
          Request a new link from the sign-in page or use &ldquo;Forgot password&rdquo;.
        </p>
      </AuthCard>
    );
  }

  const title = parsed.data.type === "recovery" ? "Reset your password" : "Confirm it's you";
  return (
    <AuthCard title={title} description="Continue to finish signing in on this device.">
      <ConfirmLinkForm
        tokenHash={parsed.data.tokenHash}
        type={parsed.data.type}
        next={parsed.data.next}
      />
    </AuthCard>
  );
}
