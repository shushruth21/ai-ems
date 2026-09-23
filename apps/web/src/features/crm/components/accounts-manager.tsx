"use client";

import { Building2, Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";

import { FormFeedback } from "@/components/forms/form-feedback";
import { useActionForm, type FormFeedback as Feedback } from "@/lib/use-action-form";
import { ACCOUNT_TYPES, accountSchema } from "@ai-ems/contracts/crm";
import { Badge } from "@ai-ems/ui/components/ui/badge";
import { Button } from "@ai-ems/ui/components/ui/button";
import { EmptyState } from "@ai-ems/ui/components/data/empty-state";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@ai-ems/ui/components/ui/table";

import { editAccount, newAccount, removeAccount } from "../actions";

export interface AccountView {
  id: string;
  name: string;
  type: string;
  industry: string | null;
  website: string | null;
  contactCount: number;
  openLeadCount: number;
}

type Values = z.input<typeof accountSchema>;

const TYPE_LABELS: Record<string, string> = {
  CUSTOMER: "Customer",
  PROSPECT: "Prospect",
  PARTNER: "Partner",
  OTHER: "Other",
};

export function AccountsManager({
  slug,
  accounts,
  canWrite,
}: {
  slug: string;
  accounts: AccountView[];
  canWrite: boolean;
}) {
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [pending, startTransition] = useTransition();
  const editing = accounts.find((a) => a.id === editingId);

  return (
    <div className="grid gap-4">
      {canWrite ? (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setEditingId(editingId === "new" ? null : "new")}>
            <Plus aria-hidden />
            New account
          </Button>
        </div>
      ) : null}

      <FormFeedback feedback={feedback} />

      {editingId ? (
        <AccountForm
          slug={slug}
          account={editing}
          onDone={(message) => {
            setEditingId(null);
            setFeedback({ tone: "success", message });
          }}
          onCancel={() => setEditingId(null)}
        />
      ) : null}

      {accounts.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No accounts yet"
          description="Companies you sell to, and the people who work there."
        />
      ) : (
        <div
          className="overflow-x-auto rounded-lg border"
          role="region"
          tabIndex={0}
          aria-label="Accounts"
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Industry</TableHead>
                <TableHead className="text-right">Contacts</TableHead>
                <TableHead className="text-right">Open leads</TableHead>
                {canWrite ? <TableHead className="text-right">Actions</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((account) => (
                <TableRow key={account.id}>
                  <TableCell className="font-medium">
                    {account.name}
                    {account.website ? (
                      <a
                        className="block text-sm text-muted-foreground underline-offset-4 hover:underline"
                        href={account.website}
                        rel="noreferrer noopener"
                        target="_blank"
                      >
                        {account.website.replace(/^https?:\/\//, "")}
                      </a>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <Badge tone={account.type === "CUSTOMER" ? "success" : "neutral"}>
                      {TYPE_LABELS[account.type] ?? account.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{account.industry ?? "—"}</TableCell>
                  <TableCell className="text-right">{account.contactCount}</TableCell>
                  <TableCell className="text-right">{account.openLeadCount}</TableCell>
                  {canWrite ? (
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        onClick={() => setEditingId(account.id)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        aria-label={`Archive ${account.name}`}
                        onClick={() =>
                          startTransition(async () => {
                            const result = await removeAccount(slug, { accountId: account.id });
                            setFeedback(
                              result.ok
                                ? { tone: "success", message: result.message ?? "Archived." }
                                : {
                                    tone: "danger",
                                    message: result.formError ?? "That didn't work.",
                                  },
                            );
                          })
                        }
                      >
                        Archive
                      </Button>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function AccountForm({
  slug,
  account,
  onDone,
  onCancel,
}: {
  slug: string;
  account?: AccountView;
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  const form = useForm<Values, unknown, z.output<typeof accountSchema>>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      name: account?.name ?? "",
      type: (account?.type as Values["type"]) ?? "PROSPECT",
      industry: account?.industry ?? "",
      website: account?.website ?? "",
      taxId: "",
    },
  });
  const { onSubmit, pending, feedback } = useActionForm(
    form,
    (values) => (account ? editAccount(slug, account.id, values) : newAccount(slug, values)),
    { onSuccess: (result) => onDone(result.message ?? "Saved.") },
  );

  return (
    <Form {...form}>
      <form
        onSubmit={onSubmit}
        noValidate
        className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2"
        aria-label={account ? `Edit ${account.name}` : "New account"}
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Company name</FormLabel>
              <FormControl>
                <Input placeholder="Harbor Hotels" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Type</FormLabel>
              <FormControl>
                <NativeSelect {...field}>
                  {ACCOUNT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {TYPE_LABELS[type] ?? type}
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
          name="industry"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Industry</FormLabel>
              <FormControl>
                <Input placeholder="Hospitality" {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="website"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Website</FormLabel>
              <FormControl>
                <Input placeholder="https://example.com" {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="sm:col-span-2">
          <FormFeedback feedback={feedback} />
        </div>
        <div className="flex gap-2 sm:col-span-2">
          <Button type="submit" loading={pending}>
            {account ? "Save account" : "Create account"}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  );
}
