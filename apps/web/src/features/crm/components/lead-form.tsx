"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";

import { FormFeedback } from "@/components/forms/form-feedback";
import { useActionForm } from "@/lib/use-action-form";
import { createLeadSchema, LEAD_SOURCES } from "@ai-ems/contracts/crm";
import { Button } from "@ai-ems/ui/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@ai-ems/ui/components/ui/form";
import { Input } from "@ai-ems/ui/components/ui/input";
import { NativeSelect } from "@ai-ems/ui/components/ui/native-select";

import { editLead, newLead } from "../actions";

export interface PickerOption {
  id: string;
  name: string;
}

export interface LeadFormValues {
  id?: string;
  title: string;
  source: string;
  campaign: string;
  accountId: string;
  contactId: string;
  estimatedValue: string;
  nextFollowUpAt: string;
}

type Values = z.input<typeof createLeadSchema>;

const SOURCE_LABELS: Record<string, string> = {
  WEBSITE: "Website",
  REFERRAL: "Referral",
  WALK_IN: "Walk-in",
  PHONE: "Phone",
  EMAIL: "Email",
  SOCIAL: "Social",
  PAID_ADS: "Paid ads",
  PARTNER: "Partner",
  EVENT: "Event",
  OTHER: "Other",
};

/** Create and edit share one form: the same fields, a different action. */
export function LeadForm({
  slug,
  lead,
  accounts,
  contacts,
  onSaved,
}: {
  slug: string;
  lead?: LeadFormValues;
  accounts: PickerOption[];
  contacts: PickerOption[];
  onSaved?: () => void;
}) {
  const form = useForm<Values, unknown, z.output<typeof createLeadSchema>>({
    resolver: zodResolver(createLeadSchema),
    defaultValues: {
      title: lead?.title ?? "",
      source: (lead?.source as Values["source"]) ?? "WALK_IN",
      campaign: lead?.campaign ?? "",
      accountId: lead?.accountId ?? "",
      contactId: lead?.contactId ?? "",
      estimatedValue: lead?.estimatedValue ?? "",
      nextFollowUpAt: lead?.nextFollowUpAt ?? "",
    },
  });
  const { onSubmit, pending, feedback } = useActionForm(
    form,
    (values) => (lead?.id ? editLead(slug, { ...values, leadId: lead.id }) : newLead(slug, values)),
    { onSuccess: () => onSaved?.() },
  );

  return (
    <Form {...form}>
      <form
        onSubmit={onSubmit}
        noValidate
        className="grid gap-4"
        aria-label={lead?.id ? "Edit lead" : "New lead"}
      >
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>What do they want?</FormLabel>
              <FormControl>
                <Input placeholder="Three-seat sofa in olive velvet" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="source"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Source</FormLabel>
                <FormControl>
                  <NativeSelect {...field}>
                    {LEAD_SOURCES.map((source) => (
                      <option key={source} value={source}>
                        {SOURCE_LABELS[source] ?? source}
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
            name="campaign"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Campaign</FormLabel>
                <FormControl>
                  <Input placeholder="Autumn showroom" {...field} value={field.value ?? ""} />
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
                    <option value="">Not linked yet</option>
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
            name="contactId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Contact</FormLabel>
                <FormControl>
                  <NativeSelect {...field} value={field.value ?? ""}>
                    <option value="">Not linked yet</option>
                    {contacts.map((contact) => (
                      <option key={contact.id} value={contact.id}>
                        {contact.name}
                      </option>
                    ))}
                  </NativeSelect>
                </FormControl>
                <FormDescription>Needed before the lead can be qualified.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="estimatedValue"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Estimated value</FormLabel>
                <FormControl>
                  <Input
                    inputMode="decimal"
                    placeholder="2500"
                    {...field}
                    value={field.value ?? ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="nextFollowUpAt"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Follow up on</FormLabel>
                <FormControl>
                  <Input type="date" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormFeedback feedback={feedback} />
        <div>
          <Button type="submit" loading={pending}>
            {lead?.id ? "Save lead" : "Create lead"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
