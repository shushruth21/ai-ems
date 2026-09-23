"use client";

import { CalendarClock, Pencil } from "lucide-react";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";

import { FormFeedback } from "@/components/forms/form-feedback";
import { useActionForm, type FormFeedback as Feedback } from "@/lib/use-action-form";
import { ACTIVITY_TYPES, logActivitySchema } from "@ai-ems/contracts/crm";
import { StatusBadge } from "@ai-ems/ui/components/data/status-badge";
import { Button } from "@ai-ems/ui/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@ai-ems/ui/components/ui/form";
import { Input } from "@ai-ems/ui/components/ui/input";
import { NativeSelect } from "@ai-ems/ui/components/ui/native-select";
import { Textarea } from "@ai-ems/ui/components/ui/textarea";
import { formatCurrency, formatDate } from "@ai-ems/ui/lib/format";

import { addActivity, moveLead, reassignLead } from "../actions";
import { LeadForm, type PickerOption } from "./lead-form";

export interface LeadView {
  id: string;
  number: string;
  title: string;
  status: string;
  source: string;
  campaign: string | null;
  accountId: string;
  accountName: string | null;
  contactId: string;
  contactName: string | null;
  ownerId: string | null;
  ownerName: string | null;
  estimatedValue: number | null;
  estimatedValueInput: string;
  nextFollowUpAt: string | null;
  lostReason: string | null;
  availableActions: string[];
  createdAt: string;
}

export interface ActivityView {
  id: string;
  type: string;
  subject: string;
  body: string | null;
  outcome: string | null;
  occurredAt: string;
  actorName: string | null;
}

const ACTION_LABELS: Record<string, string> = {
  contact: "Mark contacted",
  qualify: "Qualify",
  propose: "Send proposal",
  win: "Mark won",
  lose: "Mark lost",
  disqualify: "Disqualify",
  reopen: "Reopen",
};

const NEEDS_REASON = new Set(["lose", "disqualify"]);

export function LeadWorkspace({
  slug,
  lead,
  activities,
  accounts,
  contacts,
  members,
  canWrite,
  canAssign,
}: {
  slug: string;
  lead: LeadView;
  activities: ActivityView[];
  accounts: PickerOption[];
  contacts: PickerOption[];
  members: PickerOption[];
  canWrite: boolean;
  canAssign: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (action: string, reason?: string) =>
    startTransition(async () => {
      const result = await moveLead(slug, { leadId: lead.id, action, reason: reason ?? "" });
      setPendingAction(null);
      setFeedback(
        result.ok
          ? { tone: "success", message: result.message ?? "Done." }
          : { tone: "danger", message: result.formError ?? "That didn't work." },
      );
    });

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <div className="grid gap-6">
        <FormFeedback feedback={feedback} />

        <section className="grid gap-3 rounded-lg border p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-md font-semibold">Details</h2>
              <p className="text-sm text-muted-foreground">
                {lead.accountName ?? "No account"} · {lead.contactName ?? "No contact"} ·{" "}
                {lead.estimatedValue === null
                  ? "No value yet"
                  : formatCurrency(lead.estimatedValue)}
              </p>
            </div>
            {canWrite ? (
              <Button variant="outline" size="sm" onClick={() => setEditing((v) => !v)}>
                <Pencil aria-hidden />
                {editing ? "Cancel" : "Edit"}
              </Button>
            ) : null}
          </div>

          {editing ? (
            <LeadForm
              slug={slug}
              accounts={accounts}
              contacts={contacts}
              onSaved={() => setEditing(false)}
              lead={{
                id: lead.id,
                title: lead.title,
                source: lead.source,
                campaign: lead.campaign ?? "",
                accountId: lead.accountId,
                contactId: lead.contactId,
                estimatedValue: lead.estimatedValueInput,
                nextFollowUpAt: lead.nextFollowUpAt ?? "",
              }}
            />
          ) : (
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <Detail label="Status" value={<StatusBadge status={lead.status} />} />
              <Detail label="Owner" value={lead.ownerName ?? "Unassigned"} />
              <Detail label="Source" value={lead.source.toLowerCase().replace("_", " ")} />
              <Detail label="Campaign" value={lead.campaign ?? "—"} />
              <Detail
                label="Next follow-up"
                value={lead.nextFollowUpAt ? formatDate(lead.nextFollowUpAt) : "Not scheduled"}
              />
              <Detail label="Created" value={formatDate(lead.createdAt)} />
              {lead.lostReason ? <Detail label="Reason" value={lead.lostReason} /> : null}
            </dl>
          )}
        </section>

        <section className="grid gap-3">
          <h2 className="text-md font-semibold">Timeline</h2>
          {canWrite ? <ActivityForm slug={slug} leadId={lead.id} /> : null}
          {activities.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing logged yet.</p>
          ) : (
            <ol className="grid gap-3" aria-label="Activity timeline">
              {activities.map((activity) => (
                <li key={activity.id} className="rounded-lg border p-3">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{activity.subject}</span>
                    <span className="text-xs text-muted-foreground uppercase">{activity.type}</span>
                  </p>
                  {activity.body ? <p className="text-sm">{activity.body}</p> : null}
                  <p className="text-xs text-muted-foreground">
                    {activity.actorName ?? "Someone"} ·{" "}
                    <time dateTime={activity.occurredAt}>
                      {new Date(activity.occurredAt).toLocaleString()}
                    </time>
                    {activity.outcome ? ` · ${activity.outcome.toLowerCase()}` : null}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <aside className="grid h-fit gap-4 rounded-lg border p-4">
        <div className="grid gap-2">
          <h2 className="text-md font-semibold">Next step</h2>
          {lead.availableActions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              This lead is closed — nothing left to do here.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {lead.availableActions.map((action) => (
                <Button
                  key={action}
                  size="sm"
                  variant={action === "win" ? "primary" : "outline"}
                  disabled={pending || !canWrite}
                  onClick={() =>
                    NEEDS_REASON.has(action) ? setPendingAction(action) : run(action)
                  }
                >
                  {ACTION_LABELS[action] ?? action}
                </Button>
              ))}
            </div>
          )}
          {pendingAction ? (
            <ReasonPrompt
              action={pendingAction}
              pending={pending}
              onCancel={() => setPendingAction(null)}
              onConfirm={(reason) => run(pendingAction, reason)}
            />
          ) : null}
        </div>

        {canAssign ? (
          <div className="grid gap-2">
            <label className="text-sm font-medium" htmlFor="lead-owner">
              Owner
            </label>
            <NativeSelect
              id="lead-owner"
              defaultValue={lead.ownerId ?? ""}
              disabled={pending}
              onChange={(event) =>
                startTransition(async () => {
                  const result = await reassignLead(slug, {
                    leadId: lead.id,
                    ownerId: event.target.value,
                  });
                  setFeedback(
                    result.ok
                      ? { tone: "success", message: result.message ?? "Reassigned." }
                      : { tone: "danger", message: result.formError ?? "That didn't work." },
                  );
                })
              }
            >
              <option value="">Unassigned</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </NativeSelect>
          </div>
        ) : null}
      </aside>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium capitalize">{value}</dd>
    </div>
  );
}

function ReasonPrompt({
  action,
  pending,
  onCancel,
  onConfirm,
}: {
  action: string;
  pending: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <div className="grid gap-2 rounded-md border bg-surface p-3">
      <label className="text-sm font-medium" htmlFor="lead-reason">
        Why was it {action === "lose" ? "lost" : "disqualified"}?
      </label>
      <Input
        id="lead-reason"
        value={reason}
        placeholder="Went with another supplier"
        onChange={(event) => setReason(event.target.value)}
      />
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={pending || reason.trim().length === 0}
          onClick={() => onConfirm(reason)}
        >
          Confirm
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function ActivityForm({ slug, leadId }: { slug: string; leadId: string }) {
  type Values = z.input<typeof logActivitySchema>;
  const form = useForm<Values, unknown, z.output<typeof logActivitySchema>>({
    resolver: zodResolver(logActivitySchema),
    defaultValues: { leadId, type: "CALL", subject: "", body: "", nextFollowUpAt: "" },
  });
  const { onSubmit, pending, feedback } = useActionForm(
    form,
    (values) => addActivity(slug, values),
    {
      onSuccess: () =>
        form.reset({ leadId, type: "CALL", subject: "", body: "", nextFollowUpAt: "" }),
    },
  );

  return (
    <Form {...form}>
      <form
        onSubmit={onSubmit}
        method="post"
        noValidate
        className="grid gap-3 rounded-lg border p-4"
        aria-label="Log activity"
      >
        <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Type</FormLabel>
                <FormControl>
                  <NativeSelect {...field}>
                    {ACTIVITY_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type.charAt(0) + type.slice(1).toLowerCase()}
                      </option>
                    ))}
                  </NativeSelect>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="subject"
            render={({ field }) => (
              <FormItem>
                <FormLabel>What happened?</FormLabel>
                <FormControl>
                  <Input placeholder="Called about fabric samples" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="body"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea rows={2} {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex flex-wrap items-end gap-3">
          <FormField
            control={form.control}
            name="nextFollowUpAt"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <CalendarClock aria-hidden className="inline size-4" /> Next follow-up
                </FormLabel>
                <FormControl>
                  <Input type="date" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" loading={pending}>
            Log activity
          </Button>
        </div>
        <FormFeedback feedback={feedback} />
      </form>
    </Form>
  );
}
