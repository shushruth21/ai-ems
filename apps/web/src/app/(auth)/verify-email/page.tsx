import { MailCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard } from "@/features/auth/components/auth-card";

export const metadata: Metadata = { title: "Check your email" };

export default function VerifyEmailPage() {
  return (
    <AuthCard
      title="Check your email"
      footer={
        <Link
          href="/login"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Back to sign in
        </Link>
      }
    >
      <div className="flex gap-3">
        <MailCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
        <p className="text-sm text-muted-foreground">
          If the address can be used, we&apos;ve sent a confirmation link to it. Open the link on
          this device to finish creating your account. It expires after one hour — check your spam
          folder if it doesn&apos;t arrive.
        </p>
      </div>
    </AuthCard>
  );
}
