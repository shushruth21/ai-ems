"use client";

import { Contact as ContactIcon, Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";

import { FormFeedback } from "@/components/forms/form-feedback";
import { useActionForm, type FormFeedback as Feedback } from "@/lib/use-action-form";
import { contactSchema } from "@ai-ems/contracts/crm";
import { Button } from "@ai-ems/ui/components/ui/button";
import { Checkbox } from "@ai-ems/ui/components/ui/checkbox";
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

import { editContact, newContact, removeContact } from "../actions";
import type { PickerOption } from "./lead-form";

export interface ContactView {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  jobTitle: string | null;
  accountId: string | null;
  accountName: string | null;
  marketingOptIn: boolean;
}

type Values = z.input<typeof contactSchema>;

export function ContactsManager({
  slug,
  contacts,
  accounts,
  canWrite,
}: {
  slug: string;
  contacts: ContactView[];
  accounts: PickerOption[];
  canWrite: boolean;
}) {
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [pending, startTransition] = useTransition();
  const editing = contacts.find((c) => c.id === editingId);

  return (
    <div className="grid gap-4">
      {canWrite ? (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setEditingId(editingId === "new" ? null : "new")}>
            <Plus aria-hidden />
            New contact
          </Button>
        </div>
      ) : null}

      <FormFeedback feedback={feedback} />

      {editingId ? (
        <ContactForm
          slug={slug}
          accounts={accounts}
          contact={editing}
          onDone={(message) => {
            setEditingId(null);
            setFeedback({ tone: "success", message });
          }}
          onCancel={() => setEditingId(null)}
        />
      ) : null}

      {contacts.length === 0 ? (
        <EmptyState
          icon={ContactIcon}
          title="No contacts yet"
          description="The people you actually talk to, linked to their company."
        />
      ) : (
        <div
          className="overflow-x-auto rounded-lg border"
          role="region"
          tabIndex={0}
          aria-label="Contacts"
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Marketing</TableHead>
                {canWrite ? <TableHead className="text-right">Actions</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.map((contact) => {
                const fullName = [contact.firstName, contact.lastName].filter(Boolean).join(" ");
                return (
                  <TableRow key={contact.id}>
                    <TableCell className="font-medium">
                      {fullName}
                      {contact.jobTitle ? (
                        <span className="block text-sm text-muted-foreground">
                          {contact.jobTitle}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {contact.accountName ?? "—"}
                    </TableCell>
                    <TableCell>{contact.email ?? "—"}</TableCell>
                    <TableCell>{contact.phone ?? "—"}</TableCell>
                    <TableCell>{contact.marketingOptIn ? "Opted in" : "No"}</TableCell>
                    {canWrite ? (
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={pending}
                          onClick={() => setEditingId(contact.id)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={pending}
                          aria-label={`Archive ${fullName}`}
                          onClick={() =>
                            startTransition(async () => {
                              const result = await removeContact(slug, { contactId: contact.id });
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
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function ContactForm({
  slug,
  contact,
  accounts,
  onDone,
  onCancel,
}: {
  slug: string;
  contact?: ContactView;
  accounts: PickerOption[];
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  const form = useForm<Values, unknown, z.output<typeof contactSchema>>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      firstName: contact?.firstName ?? "",
      lastName: contact?.lastName ?? "",
      email: contact?.email ?? "",
      phone: contact?.phone ?? "",
      jobTitle: contact?.jobTitle ?? "",
      accountId: contact?.accountId ?? "",
      marketingOptIn: contact?.marketingOptIn ?? false,
    },
  });
  const { onSubmit, pending, feedback } = useActionForm(
    form,
    (values) => (contact ? editContact(slug, contact.id, values) : newContact(slug, values)),
    { onSuccess: (result) => onDone(result.message ?? "Saved.") },
  );

  return (
    <Form {...form}>
      <form
        onSubmit={onSubmit}
        noValidate
        className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2"
        aria-label={contact ? "Edit contact" : "New contact"}
      >
        <FormField
          control={form.control}
          name="firstName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>First name</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="lastName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Last name</FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Phone</FormLabel>
              <FormControl>
                <Input type="tel" {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="jobTitle"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Job title</FormLabel>
              <FormControl>
                <Input placeholder="Facilities manager" {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="accountId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Account</FormLabel>
              <FormControl>
                <NativeSelect {...field} value={field.value ?? ""}>
                  <option value="">No account</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
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
          name="marketingOptIn"
          render={({ field }) => (
            <FormItem className="sm:col-span-2">
              <label className="flex items-center gap-2 text-sm">
                <FormControl>
                  <Checkbox
                    checked={field.value ?? false}
                    onCheckedChange={(value) => field.onChange(value === true)}
                  />
                </FormControl>
                They agreed to marketing email
              </label>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="sm:col-span-2">
          <FormFeedback feedback={feedback} />
        </div>
        <div className="flex gap-2 sm:col-span-2">
          <Button type="submit" loading={pending}>
            {contact ? "Save contact" : "Create contact"}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  );
}
