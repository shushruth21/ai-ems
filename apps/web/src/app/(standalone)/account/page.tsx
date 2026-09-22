import type { Metadata } from "next";

import { ChangePasswordForm } from "@/features/auth/components/change-password-form";
import { FormFeedback } from "@/components/forms/form-feedback";
import { MfaSettings } from "@/features/auth/components/mfa-settings";
import { SecurityActivity } from "@/features/auth/components/security-activity";
import { SessionActions } from "@/features/auth/components/session-actions";
import { firstParam, queryMessage } from "@/features/auth/messages";
import { requireSession } from "@/server/auth/session";
import { PageHeader } from "@ai-ems/ui/components/data/page-header";
import { Avatar, AvatarFallback } from "@ai-ems/ui/components/ui/avatar";
import { Badge } from "@ai-ems/ui/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@ai-ems/ui/components/ui/card";
import { isEnabled } from "@ai-ems/config/flags";
import { initialsOf } from "@ai-ems/ui/lib/initials";
import type { AuthEventView } from "@ai-ems/db/auth/auth-events";
import { logger } from "@ai-ems/observability/logger";

export const metadata: Metadata = { title: "Account & security" };

async function loadActivity(profileId: string): Promise<AuthEventView[] | null> {
  try {
    const [{ prisma }, { listRecentAuthEvents }] = await Promise.all([
      import("@ai-ems/db/client"),
      import("@ai-ems/db/auth/auth-events"),
    ]);
    return await listRecentAuthEvents(prisma, profileId, 15);
  } catch (error) {
    logger.error("auth.activity_unavailable", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export default async function AccountPage({ searchParams }: PageProps<"/account">) {
  const user = await requireSession({ next: "/account" });
  const params = await searchParams;
  const events = await loadActivity(user.id);
  const name = user.fullName ?? user.email;
  const hasPassword = user.providers.includes("email");

  return (
    <div className="grid gap-6">
      <PageHeader title="Account & security" description="Manage how you sign in to AI EMS." />
      <FormFeedback feedback={queryMessage({ notice: firstParam(params.notice) })} />

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <Avatar className="size-12">
            <AvatarFallback>{initialsOf(name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate font-medium" data-testid="account-name">
              {name}
            </p>
            <p className="truncate text-sm text-muted-foreground" data-testid="account-email">
              {user.email}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>Changing it signs you out on every other device.</CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm email={user.email} hasPassword={hasPassword} />
        </CardContent>
      </Card>

      {isEnabled("MFA_TOTP") || user.verifiedFactors.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Two-factor authentication
              {user.verifiedFactors.length > 0 ? null : <Badge tone="warning">Off</Badge>}
            </CardTitle>
            <CardDescription>
              Protects your account even if your password is stolen. Strongly recommended for
              administrators.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MfaSettings factors={user.verifiedFactors} canRemove={user.aal === "aal2"} />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Sessions</CardTitle>
          <CardDescription>
            {user.lastSignInAt
              ? `Last sign-in ${new Date(user.lastSignInAt).toUTCString()}.`
              : "Sign out here or on every device at once."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SessionActions />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent security activity</CardTitle>
          <CardDescription>Sign-ins and security changes on your account.</CardDescription>
        </CardHeader>
        <CardContent>
          <SecurityActivity events={events} />
        </CardContent>
      </Card>
    </div>
  );
}
