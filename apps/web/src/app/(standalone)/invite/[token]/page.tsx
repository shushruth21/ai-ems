import { MailWarning } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { signOut } from "@/features/auth/actions";
import { AcceptInvitation } from "@/features/organizations/components/accept-invitation";
import { withNext } from "@/lib/routes";
import { getSessionUser } from "@/server/auth/session";
import { invitationTokenSchema } from "@ai-ems/contracts/organization";
import { prisma } from "@ai-ems/db/client";
import { findInvitationByToken } from "@ai-ems/db/platform/invitations";
import { invitationMatchesEmail } from "@ai-ems/domain/organization/invitation";
import { Button } from "@ai-ems/ui/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@ai-ems/ui/components/ui/card";

export const metadata: Metadata = { title: "Invitation", referrer: "no-referrer" };

function Shell({
  title,
  description,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="mx-auto grid max-w-md gap-4">
      <Card>
        <CardHeader>
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </CardHeader>
        {children ? <CardContent className="grid gap-3">{children}</CardContent> : null}
      </Card>
    </div>
  );
}

const STATE_COPY = {
  accepted: "This invitation has already been used.",
  revoked: "This invitation was withdrawn or replaced by a newer one.",
  expired: "This invitation has expired.",
} as const;

export default async function InvitePage({ params }: PageProps<"/invite/[token]">) {
  const { token } = await params;
  const valid = invitationTokenSchema.safeParse(token).success;
  const invitation = valid ? await findInvitationByToken(prisma, token) : null;

  if (!invitation) {
    return (
      <Shell title="Invitation not found" description="Check that you copied the whole link.">
        <p className="text-sm text-muted-foreground">
          Ask the person who invited you for a new link.
        </p>
      </Shell>
    );
  }
  if (invitation.state !== "pending") {
    return (
      <Shell
        title={`Invitation to ${invitation.organization.name}`}
        description={STATE_COPY[invitation.state]}
      >
        <Button asChild variant="outline">
          <Link href="/app">Go to your workspace</Link>
        </Button>
      </Shell>
    );
  }

  const user = await getSessionUser().catch(() => null);
  const summary = (
    <>
      {invitation.invitedBy ?? "Someone"} invited{" "}
      <span className="font-medium text-foreground">{invitation.email}</span> to join{" "}
      <span className="font-medium text-foreground">{invitation.organization.name}</span> as{" "}
      <span className="font-medium text-foreground">{invitation.roleName}</span>.
    </>
  );
  const next = `/invite/${token}`;

  if (!user) {
    return (
      <Shell title={`Join ${invitation.organization.name}`} description={summary}>
        <Button asChild>
          <Link href={withNext("/signup", next) as "/signup"}>Create an account</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={withNext("/login", next) as "/login"}>I already have an account</Link>
        </Button>
        <p className="text-sm text-muted-foreground">
          Use {invitation.email} so the invitation matches.
        </p>
      </Shell>
    );
  }

  if (!invitationMatchesEmail(invitation.email, user.email)) {
    return (
      <Shell title="This invitation is for someone else" description={summary}>
        <div className="flex gap-3 text-sm">
          <MailWarning className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          <p>
            You&apos;re signed in as <span className="font-medium">{user.email}</span>. Sign out and
            sign in with <span className="font-medium">{invitation.email}</span> to accept.
          </p>
        </div>
        <form action={signOut}>
          <Button type="submit" variant="outline" className="w-full">
            Sign out
          </Button>
        </form>
      </Shell>
    );
  }

  return (
    <Shell title={`Join ${invitation.organization.name}`} description={summary}>
      <AcceptInvitation token={token} organizationName={invitation.organization.name} />
    </Shell>
  );
}
