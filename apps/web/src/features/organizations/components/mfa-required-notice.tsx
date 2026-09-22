import { ShieldAlert } from "lucide-react";
import Link from "next/link";

import { Button } from "@ai-ems/ui/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@ai-ems/ui/components/ui/card";

/**
 * Shown instead of the workspace when its security policy requires MFA and
 * this session hasn't completed it (the database enforces the same rule).
 */
export function MfaRequiredNotice({
  organizationName,
  hasFactor,
  slug,
}: {
  organizationName: string;
  hasFactor: boolean;
  slug: string;
}) {
  return (
    <main className="mx-auto grid min-h-dvh max-w-lg content-center px-4 py-10">
      <Card>
        <CardHeader>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <ShieldAlert className="size-5 text-warning" aria-hidden />
            Two-factor authentication required
          </h1>
          <CardDescription>
            {organizationName} requires every member to sign in with an authenticator app.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <Button asChild>
            <Link
              href={
                hasFactor
                  ? `/login/mfa?next=${encodeURIComponent(`/${slug}/dashboard`)}`
                  : "/account?notice=mfa-required"
              }
            >
              {hasFactor ? "Enter your code" : "Set up two-factor authentication"}
            </Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/app">Switch workspace</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
