"use client";

import { Check, Save } from "lucide-react";
import { useMemo, useState, useTransition } from "react";

import { FormFeedback } from "@/components/forms/form-feedback";
import type { FormFeedback as Feedback } from "@/lib/use-action-form";
import {
  priceConfiguration,
  visibleGroups,
  type Configuration,
  type ProductSpec,
} from "@ai-ems/domain/catalog/configuration";
import { Button } from "@ai-ems/ui/components/ui/button";
import { Checkbox } from "@ai-ems/ui/components/ui/checkbox";
import { Input } from "@ai-ems/ui/components/ui/input";
import { Label } from "@ai-ems/ui/components/ui/label";
import { NativeSelect } from "@ai-ems/ui/components/ui/native-select";
import { formatCurrency } from "@ai-ems/ui/lib/format";

import { saveConfiguredProduct } from "../actions";

export interface LeadOption {
  id: string;
  title: string;
}

/**
 * The guided configurator. Every keystroke re-runs the same pure functions the
 * server uses to validate and price, so what someone sees here is what gets
 * saved — the server checks it again rather than trusting the browser.
 */
export function Configurator({
  slug,
  spec,
  leads,
  defaultLeadId,
}: {
  slug: string;
  spec: ProductSpec & { id: string };
  leads: LeadOption[];
  defaultLeadId?: string;
}) {
  const [answers, setAnswers] = useState<Configuration>({});
  const [quantity, setQuantity] = useState("1");
  const [name, setName] = useState("");
  const [leadId, setLeadId] = useState(defaultLeadId ?? "");
  const [touched, setTouched] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [pending, startTransition] = useTransition();

  const shown = useMemo(() => visibleGroups(spec, answers), [spec, answers]);
  const priced = useMemo(
    () => priceConfiguration(spec, answers, { quantity: quantity || "1" }),
    [spec, answers, quantity],
  );
  const issueFor = (code: string) =>
    touched ? priced.issues.find((i) => i.group === code)?.message : undefined;

  const set = (code: string, value: Configuration[string]) =>
    setAnswers((prev) => ({ ...prev, [code]: value }));

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <form
        className="grid gap-4"
        method="post"
        aria-label="Configure this product"
        onSubmit={(event) => {
          event.preventDefault();
          setTouched(true);
          if (!priced.ok) {
            setFeedback({ tone: "danger", message: "Finish the questions marked below." });
            return;
          }
          startTransition(async () => {
            const result = await saveConfiguredProduct(slug, {
              productId: spec.id,
              leadId,
              name,
              quantity,
              answers: JSON.stringify(priced.cleaned),
            });
            setFeedback(
              result.ok
                ? { tone: "success", message: result.message ?? "Saved." }
                : { tone: "danger", message: result.formError ?? "That didn't work." },
            );
            if (result.ok) {
              setName("");
              setAnswers({});
              setTouched(false);
            }
          });
        }}
      >
        <FormFeedback feedback={feedback} />

        {shown.map((group) => {
          const issue = issueFor(group.code);
          const id = `group-${group.code}`;
          const describedBy = issue ? `${id}-error` : undefined;
          return (
            <div key={group.code} className="grid gap-1.5 rounded-lg border p-4">
              <Label htmlFor={id}>
                {group.label}
                {group.required ? (
                  <span className="text-danger" aria-hidden>
                    {" "}
                    *
                  </span>
                ) : null}
              </Label>

              {group.input === "SELECT" ? (
                <NativeSelect
                  id={id}
                  aria-describedby={describedBy}
                  aria-invalid={issue ? true : undefined}
                  value={String(answers[group.code] ?? "")}
                  onChange={(event) => set(group.code, event.target.value || null)}
                >
                  <option value="">— choose —</option>
                  {group.options.map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.label}
                      {option.priceDelta !== "0" ? ` (+${option.priceDelta})` : ""}
                      {option.pricePctDelta !== "0" ? ` (+${option.pricePctDelta}%)` : ""}
                    </option>
                  ))}
                </NativeSelect>
              ) : null}

              {group.input === "MULTI_SELECT" ? (
                <fieldset className="grid gap-1" aria-describedby={describedBy}>
                  <legend className="sr-only">{group.label}</legend>
                  {group.options.map((option) => {
                    const current = (answers[group.code] as string[] | undefined) ?? [];
                    return (
                      <label key={option.code} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={current.includes(option.code)}
                          onCheckedChange={(checked) =>
                            set(
                              group.code,
                              checked === true
                                ? [...current, option.code]
                                : current.filter((c) => c !== option.code),
                            )
                          }
                        />
                        {option.label}
                        <span className="text-muted-foreground">
                          {option.priceDelta !== "0" ? `+${option.priceDelta}` : null}
                        </span>
                      </label>
                    );
                  })}
                </fieldset>
              ) : null}

              {group.input === "NUMBER" ? (
                <Input
                  id={id}
                  inputMode="decimal"
                  aria-describedby={describedBy}
                  aria-invalid={issue ? true : undefined}
                  placeholder={
                    group.minValue !== null && group.maxValue !== null
                      ? `${group.minValue} – ${group.maxValue}`
                      : undefined
                  }
                  value={String(answers[group.code] ?? "")}
                  onChange={(event) => set(group.code, event.target.value)}
                />
              ) : null}

              {group.input === "TEXT" ? (
                <Input
                  id={id}
                  aria-describedby={describedBy}
                  aria-invalid={issue ? true : undefined}
                  value={String(answers[group.code] ?? "")}
                  onChange={(event) => set(group.code, event.target.value)}
                />
              ) : null}

              {group.input === "BOOLEAN" ? (
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    id={id}
                    checked={answers[group.code] === true}
                    onCheckedChange={(checked) => set(group.code, checked === true)}
                  />
                  Yes, include this
                </label>
              ) : null}

              {issue ? (
                <p id={`${id}-error`} className="text-sm text-danger" role="alert">
                  {issue}
                </p>
              ) : null}
            </div>
          );
        })}

        <div className="grid gap-4 rounded-lg border p-4 sm:grid-cols-[1fr_8rem_auto] sm:items-end">
          <div className="grid gap-1.5">
            <Label htmlFor="config-name">Name this configuration</Label>
            <Input
              id="config-name"
              placeholder="Harbor lobby — olive velvet"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="config-quantity">Quantity</Label>
            <Input
              id="config-quantity"
              type="number"
              min={1}
              max={9999}
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
            />
          </div>
          <Button type="submit" loading={pending}>
            <Save aria-hidden />
            Save
          </Button>
          {leads.length > 0 ? (
            <div className="grid gap-1.5 sm:col-span-3">
              <Label htmlFor="config-lead">Put it against a lead</Label>
              <NativeSelect
                id="config-lead"
                value={leadId}
                onChange={(event) => setLeadId(event.target.value)}
              >
                <option value="">Not linked to a lead</option>
                {leads.map((lead) => (
                  <option key={lead.id} value={lead.id}>
                    {lead.title}
                  </option>
                ))}
              </NativeSelect>
            </div>
          ) : null}
        </div>
      </form>

      <aside className="grid h-fit gap-3 rounded-lg border p-4">
        <h2 className="text-md font-semibold">Running total</h2>
        <dl className="grid gap-1 text-sm">
          {priced.breakdown.components.map((component, index) => (
            <div key={`${component.label}-${index}`} className="flex justify-between gap-2">
              <dt className="text-muted-foreground">{component.label}</dt>
              <dd>{formatCurrency(Number(component.amount) / 100)}</dd>
            </div>
          ))}
        </dl>
        <div className="rounded-md bg-surface p-3">
          <p className="text-sm text-muted-foreground">Unit price</p>
          <p className="text-lg font-semibold" data-testid="configurator-unit">
            {formatCurrency(Number(priced.unitPrice))}
          </p>
          <p className="text-sm text-muted-foreground">
            {quantity || 1} × ={" "}
            <span className="font-medium text-foreground" data-testid="configurator-total">
              {formatCurrency(Number(priced.total))}
            </span>
          </p>
        </div>
        <p className="flex items-center gap-1 text-sm text-muted-foreground">
          {priced.ok ? (
            <>
              <Check aria-hidden className="size-4 text-success" />
              Ready to save
            </>
          ) : (
            `${priced.issues.length} question${priced.issues.length === 1 ? "" : "s"} left`
          )}
        </p>
      </aside>
    </div>
  );
}
