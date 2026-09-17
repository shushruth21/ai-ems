"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

export const leadFormSchema = z.object({
  company: z.string().trim().min(2, "Enter at least 2 characters"),
  email: z.email("Enter a valid email address"),
  source: z.enum(["WEBSITE", "REFERRAL", "WALK_IN", "PHONE"], { error: "Choose a source" }),
  value: z.coerce.number<string>().min(0, "Must be zero or more").max(10_000_000, "Too large"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]),
  notes: z.string().max(500, "Keep notes under 500 characters").optional(),
  followUp: z.boolean(),
  consent: z.boolean().refine((v) => v, "Consent is required"),
});

type LeadFormInput = z.input<typeof leadFormSchema>;
type LeadFormOutput = z.output<typeof leadFormSchema>;

export function SampleForm() {
  const form = useForm<LeadFormInput, unknown, LeadFormOutput>({
    resolver: zodResolver(leadFormSchema),
    defaultValues: {
      company: "",
      email: "",
      value: "",
      priority: "MEDIUM",
      notes: "",
      followUp: true,
      consent: false,
    },
    mode: "onTouched",
  });

  const onSubmit = async (values: LeadFormOutput) => {
    await new Promise((r) => setTimeout(r, 500));
    toast.success("Lead validated", { description: `${values.company} · ${values.source}` });
    form.reset();
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        noValidate
        className="grid max-w-2xl gap-5 sm:grid-cols-2"
      >
        <FormField
          control={form.control}
          name="company"
          render={({ field }) => (
            <FormItem>
              <FormLabel required>Company</FormLabel>
              <FormControl>
                <Input autoComplete="organization" placeholder="Acme Studio" {...field} />
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
              <FormLabel required>Email</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  autoComplete="email"
                  placeholder="buyer@example.com"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="source"
          render={({ field }) => (
            <FormItem>
              <FormLabel required>Source</FormLabel>
              <Select value={field.value ?? ""} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger onBlur={field.onBlur}>
                    <SelectValue placeholder="Select a source" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="WEBSITE">Website</SelectItem>
                  <SelectItem value="REFERRAL">Referral</SelectItem>
                  <SelectItem value="WALK_IN">Walk-in</SelectItem>
                  <SelectItem value="PHONE">Phone</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="value"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Estimated value (USD)</FormLabel>
              <FormControl>
                <Input
                  inputMode="decimal"
                  placeholder="0"
                  {...field}
                  value={field.value as string}
                />
              </FormControl>
              <FormDescription>Used for pipeline forecasting.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="priority"
          render={({ field }) => (
            <FormItem className="sm:col-span-2">
              <FormLabel>Priority</FormLabel>
              <FormControl>
                <RadioGroup
                  value={field.value}
                  onValueChange={field.onChange}
                  className="flex gap-5"
                >
                  {(["LOW", "MEDIUM", "HIGH"] as const).map((p) => (
                    <label key={p} className="flex items-center gap-2 text-base">
                      <RadioGroupItem value={p} />
                      {p.charAt(0) + p.slice(1).toLowerCase()}
                    </label>
                  ))}
                </RadioGroup>
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem className="sm:col-span-2">
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea placeholder="What are they looking for?" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="followUp"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between gap-4 rounded-md border p-3 sm:col-span-2">
              <div className="space-y-0.5">
                <FormLabel>Schedule a follow-up</FormLabel>
                <FormDescription>
                  Creates a task for the owner in two business days.
                </FormDescription>
              </div>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="consent"
          render={({ field }) => (
            <FormItem className="sm:col-span-2">
              <div className="flex items-center gap-2">
                <FormControl>
                  <Checkbox
                    checked={field.value === true}
                    onCheckedChange={(v) => field.onChange(v === true)}
                    onBlur={field.onBlur}
                  />
                </FormControl>
                <FormLabel>The contact agreed to be contacted</FormLabel>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex gap-2 sm:col-span-2">
          <Button type="submit" loading={form.formState.isSubmitting}>
            Validate lead
          </Button>
          <Button type="button" variant="ghost" onClick={() => form.reset()}>
            Reset
          </Button>
        </div>
      </form>
    </Form>
  );
}
