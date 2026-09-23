"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import type { z } from "zod";

import { FormFeedback } from "@/components/forms/form-feedback";
import { useActionForm } from "@/lib/use-action-form";
import { createOrganizationSchema } from "@ai-ems/contracts/organization";
import { slugify } from "@ai-ems/domain/organization/slug";
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

import { checkSlugAvailability, createOrganization } from "../actions";

type Values = z.input<typeof createOrganizationSchema>;

export interface Option {
  value: string;
  label: string;
}

/**
 * Option lists come from the server so the markup matches during hydration
 * (browsers and Node ship different ICU data); the browser's own time zone is
 * applied after mount.
 */
export function CreateOrganizationForm({
  appOrigin,
  currencies,
  timeZones,
}: {
  appOrigin: string;
  currencies: Option[];
  timeZones: string[];
}) {
  const form = useForm<Values, unknown, z.output<typeof createOrganizationSchema>>({
    resolver: zodResolver(createOrganizationSchema),
    defaultValues: { name: "", slug: "", currency: "USD", timezone: "UTC" },
    mode: "onTouched",
  });
  const [zones, setZones] = useState(timeZones);
  // Deferred to a task so the first client render matches the server markup.
  useEffect(() => {
    const handle = setTimeout(() => {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (!detected || form.getFieldState("timezone").isDirty) return;
      setZones((list) => (list.includes(detected) ? list : [...list, detected].sort()));
      form.setValue("timezone", detected);
    }, 0);
    return () => clearTimeout(handle);
  }, [form]);
  const { onSubmit, pending, feedback } = useActionForm(form, createOrganization);
  const [name = "", slug = ""] = useWatch({ control: form.control, name: ["name", "slug"] });
  const slugEdited = useRef(false);
  const [availability, setAvailability] = useState<{ ok: boolean; text: string } | null>(null);

  // Suggest the address from the name until the user edits it.
  useEffect(() => {
    if (!slugEdited.current) form.setValue("slug", slugify(name), { shouldValidate: false });
  }, [name, form]);

  // Debounced availability check.
  useEffect(() => {
    if (slug.length < 3) {
      const clear = setTimeout(() => setAvailability(null), 0);
      return () => clearTimeout(clear);
    }
    const handle = setTimeout(async () => {
      setAvailability(null);
      const res = await checkSlugAvailability(slug);
      if (res.available) setAvailability({ ok: true, text: "Available" });
      else
        setAvailability({
          ok: false,
          text: res.suggestion
            ? `${res.message} Try “${res.suggestion}”.`
            : (res.message ?? "Unavailable"),
        });
    }, 350);
    return () => clearTimeout(handle);
  }, [slug]);

  const host = appOrigin.replace(/^https?:\/\//, "");

  return (
    <Form {...form}>
      <form
        onSubmit={onSubmit}
        method="post"
        noValidate
        className="grid gap-5"
        aria-label="Create workspace"
      >
        <FormFeedback feedback={feedback} />
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Company or team name</FormLabel>
              <FormControl>
                <Input
                  autoComplete="organization"
                  autoFocus
                  placeholder="Acme Furniture"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="slug"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Workspace address</FormLabel>
              <div className="flex min-w-0 items-center rounded-md">
                <span className="hidden shrink-0 pr-1 text-sm text-muted-foreground sm:inline">
                  {host}/
                </span>
                <FormControl>
                  <Input
                    {...field}
                    autoCapitalize="none"
                    spellCheck={false}
                    onChange={(e) => {
                      slugEdited.current = true;
                      field.onChange(e.target.value.toLowerCase());
                    }}
                  />
                </FormControl>
              </div>
              <FormDescription aria-live="polite">
                {availability ? (
                  <span className={availability.ok ? "text-success" : "text-danger"}>
                    {availability.text}
                  </span>
                ) : (
                  "Lowercase letters, numbers and hyphens. You'll share links like this with your team."
                )}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="currency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Currency</FormLabel>
                <FormControl>
                  <NativeSelect {...field}>
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
                  <NativeSelect {...field}>
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
        </div>
        <Button type="submit" loading={pending} className="w-full sm:w-auto sm:justify-self-start">
          Create workspace
        </Button>
      </form>
    </Form>
  );
}
