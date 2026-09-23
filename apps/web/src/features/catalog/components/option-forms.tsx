"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";

import { FormFeedback } from "@/components/forms/form-feedback";
import { useActionForm } from "@/lib/use-action-form";
import { OPTION_INPUTS, optionGroupSchema, optionSchema } from "@ai-ems/contracts/catalog";
import { Button } from "@ai-ems/ui/components/ui/button";
import { Checkbox } from "@ai-ems/ui/components/ui/checkbox";
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

import { saveChoice, saveGroup } from "../actions";

const INPUT_LABELS: Record<string, string> = {
  SELECT: "Pick one",
  MULTI_SELECT: "Pick several",
  NUMBER: "Number",
  TEXT: "Free text",
  BOOLEAN: "Yes / no",
};

export interface GroupValues {
  id: string;
  label: string;
  input: string;
  required: boolean;
  minValue: number | null;
  maxValue: number | null;
  sortOrder: number;
}

type GroupFormValues = z.input<typeof optionGroupSchema>;

export function GroupForm({
  slug,
  productId,
  group,
  onDone,
  onCancel,
}: {
  slug: string;
  productId: string;
  group?: GroupValues;
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  const form = useForm<GroupFormValues, unknown, z.output<typeof optionGroupSchema>>({
    resolver: zodResolver(optionGroupSchema),
    defaultValues: {
      productId,
      groupId: group?.id ?? "",
      label: group?.label ?? "",
      input: (group?.input as GroupFormValues["input"]) ?? "SELECT",
      required: group?.required ?? false,
      minValue:
        group?.minValue === null || group?.minValue === undefined ? "" : String(group.minValue),
      maxValue:
        group?.maxValue === null || group?.maxValue === undefined ? "" : String(group.maxValue),
      sortOrder: String(group?.sortOrder ?? 0),
    },
  });
  const { onSubmit, pending, feedback } = useActionForm(form, (values) => saveGroup(slug, values), {
    onSuccess: (result) => onDone(result.message ?? "Saved."),
  });
  // Mirrors the select so the numeric range appears without `watch()`.
  const [inputKind, setInputKind] = useState(group?.input ?? "SELECT");

  return (
    <Form {...form}>
      <form
        onSubmit={onSubmit}
        method="post"
        noValidate
        className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2"
        aria-label={group ? `Edit ${group.label}` : "New option group"}
      >
        <FormField
          control={form.control}
          name="label"
          render={({ field }) => (
            <FormItem>
              <FormLabel>What are they choosing?</FormLabel>
              <FormControl>
                <Input placeholder="Fabric colour" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="input"
          render={({ field }) => (
            <FormItem>
              <FormLabel>How</FormLabel>
              <FormControl>
                <NativeSelect
                  {...field}
                  onChange={(event) => {
                    field.onChange(event);
                    setInputKind(event.target.value);
                  }}
                >
                  {OPTION_INPUTS.map((input) => (
                    <option key={input} value={input}>
                      {INPUT_LABELS[input] ?? input}
                    </option>
                  ))}
                </NativeSelect>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {inputKind === "NUMBER" ? (
          <>
            <FormField
              control={form.control}
              name="minValue"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Smallest</FormLabel>
                  <FormControl>
                    <Input
                      inputMode="decimal"
                      placeholder="40"
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
              name="maxValue"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Largest</FormLabel>
                  <FormControl>
                    <Input
                      inputMode="decimal"
                      placeholder="300"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        ) : null}
        <FormField
          control={form.control}
          name="required"
          render={({ field }) => (
            <FormItem className="sm:col-span-2">
              <label className="flex items-center gap-2 text-sm">
                <FormControl>
                  <Checkbox
                    checked={field.value ?? false}
                    onCheckedChange={(value) => field.onChange(value === true)}
                  />
                </FormControl>
                They must choose before ordering
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
            {group ? "Save group" : "Add group"}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  );
}

export interface OptionValues {
  id: string;
  label: string;
  priceDelta: number;
  pricePctDelta: number;
}

type OptionFormValues = z.input<typeof optionSchema>;

export function OptionForm({
  slug,
  groupId,
  option,
  onDone,
  onCancel,
}: {
  slug: string;
  groupId: string;
  option?: OptionValues;
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  const form = useForm<OptionFormValues, unknown, z.output<typeof optionSchema>>({
    resolver: zodResolver(optionSchema),
    defaultValues: {
      groupId,
      optionId: option?.id ?? "",
      label: option?.label ?? "",
      priceDelta: option ? String(option.priceDelta) : "0",
      pricePctDelta: option ? String(option.pricePctDelta) : "0",
      sortOrder: "0",
    },
  });
  const { onSubmit, pending, feedback } = useActionForm(
    form,
    (values) => saveChoice(slug, values),
    { onSuccess: (result) => onDone(result.message ?? "Saved.") },
  );

  return (
    <Form {...form}>
      <form
        onSubmit={onSubmit}
        method="post"
        noValidate
        className="mt-2 grid gap-3 rounded-lg border bg-surface p-3 sm:grid-cols-3"
        aria-label={option ? `Edit ${option.label}` : "New option"}
      >
        <FormField
          control={form.control}
          name="label"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Option</FormLabel>
              <FormControl>
                <Input placeholder="Olive velvet" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="priceDelta"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Price change</FormLabel>
              <FormControl>
                <Input inputMode="decimal" placeholder="150" {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="pricePctDelta"
          render={({ field }) => (
            <FormItem>
              <FormLabel>…or % of base</FormLabel>
              <FormControl>
                <Input inputMode="decimal" placeholder="5" {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="sm:col-span-3">
          <FormFeedback feedback={feedback} />
        </div>
        <div className="flex gap-2 sm:col-span-3">
          <Button type="submit" size="sm" loading={pending}>
            {option ? "Save option" : "Add option"}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  );
}
