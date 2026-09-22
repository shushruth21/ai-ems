"use client";

import { useState, useTransition } from "react";

import { FormFeedback } from "@/components/forms/form-feedback";
import type { FormFeedback as Feedback } from "@/lib/use-action-form";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@ai-ems/ui/components/ui/alert-dialog";
import { Button } from "@ai-ems/ui/components/ui/button";

import { leaveOrganization } from "../actions";

export function LeaveWorkspace({
  slug,
  organizationName,
}: {
  slug: string;
  organizationName: string;
}) {
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  return (
    <section className="grid gap-3 border-t pt-6">
      <h2 className="text-md font-semibold">Leave this workspace</h2>
      <p className="max-w-prose text-sm text-muted-foreground">
        You&apos;ll lose access to {organizationName} immediately. Someone with the owner role can
        invite you back.
      </p>
      <FormFeedback feedback={feedback} />
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline" className="justify-self-start" disabled={pending}>
            Leave workspace
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave {organizationName}?</AlertDialogTitle>
            <AlertDialogDescription>
              Your membership is removed. Data you created stays in the workspace.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay</AlertDialogCancel>
            <AlertDialogAction
              destructive
              onClick={() =>
                startTransition(async () => {
                  const result = await leaveOrganization(slug);
                  if (!result.ok) {
                    setFeedback({ tone: "danger", message: result.formError ?? "Couldn't leave." });
                  }
                })
              }
            >
              Leave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
