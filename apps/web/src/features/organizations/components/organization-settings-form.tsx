"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { FormFeedback } from "@/components/forms/form-feedback";
import { useActionForm } from "@/lib/use-action-form";
import { updateOrganizationSchema } from "@ai-ems/contracts/organization";
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

import { updateOrganization } from "../actions";

import type { Option } from "./create-organization-form";

type Values = z.input<typeof updateOrganizationSchema>;

export function OrganizationSettingsForm({
  slug,
  defaults,
  currencies,
  locales,
  timeZones,
  disabled,
}: {
  slug: string;
  defaults: Values;
  currencies: Option[];
  locales: Option[];
  timeZones: string[];
  disabled: boolean;
}) {
  const form = useForm<Values, unknown, z.output<typeof updateOrganizationSchema>>({
    resolver: zodResolver(updateOrganizationSchema),
    defaultValues: defaults,
    mode: "onTouched",
  });
  const { onSubmit, pending, feedback } = useActionForm(form, (values) =>
    updateOrganization(slug, values),
  );
  const zones = timeZones.includes(defaults.timezone)
    ? timeZones
    : [defaults.timezone, ...timeZones];

  return (
    <Form {...form}>
      <form
        onSubmit={onSubmit}
        noValidate
        className="grid max-w-xl gap-5"
        aria-label="Workspace settings"
      >
        <FormFeedback feedback={feedback} />
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Workspace name</FormLabel>
              <FormControl>
                <Input disabled={disabled} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="legalName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Legal name</FormLabel>
                <FormControl>
                  <Input disabled={disabled} {...field} value={field.value ?? ""} />
                </FormControl>
                <FormDescription>Used on quotes, orders and invoices.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="taxId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tax ID</FormLabel>
                <FormControl>
                  <Input disabled={disabled} {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="grid gap-5 sm:grid-cols-3">
          <FormField
            control={form.control}
            name="currency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Currency</FormLabel>
                <FormControl>
                  <NativeSelect disabled={disabled} {...field}>
                    {currencies.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
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
            name="timezone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Time zone</FormLabel>
                <FormControl>
                  <NativeSelect disabled={disabled} {...field}>
                    {zones.map((z) => (
                      <option key={z} value={z}>
                        {z.replaceAll("_", " ")}
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
            name="locale"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Language & formats</FormLabel>
                <FormControl>
                  <NativeSelect disabled={disabled} {...field}>
                    {locales.map((l) => (
                      <option key={l.value} value={l.value}>
                        {l.label}
                      </option>
                    ))}
                  </NativeSelect>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div>
          <Button type="submit" loading={pending} disabled={disabled}>
            Save changes
          </Button>
        </div>
      </form>
    </Form>
  );
}
