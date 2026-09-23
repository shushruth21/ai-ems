"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Copy, ShieldCheck } from "lucide-react";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { mfaEnrollConfirmSchema } from "@ai-ems/contracts/auth";
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
import { Badge } from "@ai-ems/ui/components/ui/badge";
import { Button } from "@ai-ems/ui/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@ai-ems/ui/components/ui/form";

import {
  cancelTotpEnrollment,
  confirmTotpEnrollment,
  removeTotpFactor,
  startTotpEnrollment,
  type TotpEnrollment,
} from "../actions";
import { useActionForm, type FormFeedback as Feedback } from "@/lib/use-action-form";

import { FormFeedback } from "@/components/forms/form-feedback";
import { OtpInput } from "./otp-input";

export interface MfaFactorView {
  id: string;
  name: string;
  createdAt: string;
}

export function MfaSettings({
  factors,
  canRemove,
}: {
  factors: MfaFactorView[];
  /** Removing a factor needs a session that already passed MFA. */
  canRemove: boolean;
}) {
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<void>) => {
    setFeedback(null);
    startTransition(fn);
  };

  if (enrollment) {
    return (
      <EnrollTotp
        enrollment={enrollment}
        onDone={(message) => {
          setEnrollment(null);
          setFeedback({ tone: "success", message });
        }}
        onCancel={() =>
          run(async () => {
            await cancelTotpEnrollment(enrollment.factorId);
            setEnrollment(null);
          })
        }
      />
    );
  }

  const factor = factors[0];
  return (
    <div className="grid gap-4">
      <FormFeedback feedback={feedback} />
      {factor ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
          <div className="flex items-center gap-3">
            <ShieldCheck className="size-5 text-success" aria-hidden />
            <div>
              <p className="font-medium">{factor.name}</p>
              <p className="text-sm text-muted-foreground">
                Added {new Date(factor.createdAt).toLocaleDateString()}
              </p>
            </div>
            <Badge tone="success">On</Badge>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={!canRemove || pending}>
                Remove
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Turn off two-factor authentication?</AlertDialogTitle>
                <AlertDialogDescription>
                  Your account will be protected by your password or email links only.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep it on</AlertDialogCancel>
                <AlertDialogAction
                  destructive
                  onClick={() =>
                    run(async () => {
                      const result = await removeTotpFactor(factor.id);
                      setFeedback(
                        result.ok
                          ? { tone: "success", message: result.message ?? "Removed." }
                          : { tone: "danger", message: result.formError ?? "Could not remove it." },
                      );
                    })
                  }
                >
                  Turn off
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Add a code from an authenticator app each time you sign in.
          </p>
          <Button
            loading={pending}
            onClick={() =>
              run(async () => {
                const result = await startTotpEnrollment();
                if (result.ok && result.data) setEnrollment(result.data);
                else if (!result.ok)
                  setFeedback({
                    tone: "danger",
                    message: result.formError ?? "Could not start setup.",
                  });
              })
            }
          >
            Set up authenticator app
          </Button>
        </div>
      )}
    </div>
  );
}

function EnrollTotp({
  enrollment,
  onDone,
  onCancel,
}: {
  enrollment: TotpEnrollment;
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const form = useForm<
    z.input<typeof mfaEnrollConfirmSchema>,
    unknown,
    z.output<typeof mfaEnrollConfirmSchema>
  >({
    resolver: zodResolver(mfaEnrollConfirmSchema),
    defaultValues: { factorId: enrollment.factorId, code: "" },
  });
  const { onSubmit, pending, feedback } = useActionForm(form, confirmTotpEnrollment, {
    onSuccess: (r) => onDone(r.message ?? "Two-factor authentication is on."),
  });

  return (
    <div className="grid gap-5" data-testid="totp-enrollment">
      <ol className="grid gap-5 sm:grid-cols-[auto_1fr]">
        <li className="grid justify-items-start gap-2">
          <span className="text-sm font-medium">1. Scan with your authenticator app</span>
          {/* Supabase returns an SVG data URL; next/image doesn't add value for it. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={enrollment.qrCode}
            alt="QR code for your authenticator app"
            width={176}
            height={176}
            className="rounded-md border bg-white p-2"
          />
        </li>
        <li className="grid content-start gap-2">
          <span className="text-sm font-medium">Can&apos;t scan? Enter this key instead</span>
          <div className="flex min-w-0 items-center gap-2">
            <code
              className="min-w-0 rounded bg-muted px-2 py-1 font-mono text-sm break-all"
              data-testid="totp-secret"
            >
              {enrollment.secret}
            </code>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={copied ? "Copied" : "Copy setup key"}
              onClick={() => {
                void navigator.clipboard?.writeText(enrollment.secret).then(() => setCopied(true));
              }}
            >
              {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
            </Button>
          </div>
        </li>
      </ol>
      <Form {...form}>
        <form
          onSubmit={onSubmit}
          method="post"
          noValidate
          className="grid max-w-xs gap-4"
          aria-label="Confirm authenticator"
        >
          <FormFeedback feedback={feedback} />
          <FormField
            control={form.control}
            name="code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>2. Enter the 6-digit code</FormLabel>
                <FormControl>
                  <OtpInput autoFocus {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="flex gap-2">
            <Button type="submit" loading={pending}>
              Turn on
            </Button>
            <Button variant="ghost" onClick={onCancel} disabled={pending}>
              Cancel
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
