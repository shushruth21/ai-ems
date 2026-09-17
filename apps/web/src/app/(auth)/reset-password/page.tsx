import type { Metadata } from "next";

import { AuthCard } from "@/features/auth/components/auth-card";
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form";
import { requireSession } from "@/server/auth/session";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage() {
  const user = await requireSession({ next: "/reset-password" });
  return (
    <AuthCard
      title="Choose a new password"
      description="After you save it, you'll be signed out everywhere else."
    >
      <ResetPasswordForm email={user.email} />
    </AuthCard>
  );
}
