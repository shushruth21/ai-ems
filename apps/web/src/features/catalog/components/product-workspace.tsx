"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState, useTransition } from "react";

import { FormFeedback } from "@/components/forms/form-feedback";
import type { FormFeedback as Feedback } from "@/lib/use-action-form";
import { unitPriceWithOptions } from "@ai-ems/domain/catalog/product-policy";
import { Badge } from "@ai-ems/ui/components/ui/badge";
import { Button } from "@ai-ems/ui/components/ui/button";
import { Input } from "@ai-ems/ui/components/ui/input";
import { NativeSelect } from "@ai-ems/ui/components/ui/native-select";
import { formatCurrency } from "@ai-ems/ui/lib/format";

import { moveProduct, removeChoice, removeGroup, removeProduct } from "../actions";
import { GroupForm, OptionForm } from "./option-forms";
import { ProductForm, type CategoryOption, type ProductFormValues } from "./product-form";

export interface OptionView {
  id: string;
  code: string;
  label: string;
  priceDelta: number;
  pricePctDelta: number;
}

export interface GroupView {
  id: string;
  code: string;
  visibleWhen: { group: string; equals: string } | null;
  label: string;
  input: string;
  required: boolean;
  minValue: number | null;
  maxValue: number | null;
  sortOrder: number;
  options: OptionView[];
}

export interface ProductView extends ProductFormValues {
  id: string;
  status: string;
  availableActions: string[];
  basePriceValue: number;
  groups: GroupView[];
}

const ACTION_LABELS: Record<string, string> = {
  publish: "Publish",
  unpublish: "Back to draft",
  discontinue: "Discontinue",
  restore: "Restore",
};

const INPUT_LABELS: Record<string, string> = {
  SELECT: "Pick one",
  MULTI_SELECT: "Pick several",
  NUMBER: "Number",
  TEXT: "Free text",
  BOOLEAN: "Yes / no",
};

const HAS_CHOICES = new Set(["SELECT", "MULTI_SELECT"]);

export function ProductWorkspace({
  slug,
  product,
  categories,
  canWrite,
}: {
  slug: string;
  product: ProductView;
  categories: CategoryOption[];
  canWrite: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [groupForm, setGroupForm] = useState<GroupView | "new" | null>(null);
  const [optionForm, setOptionForm] = useState<{ groupId: string; option?: OptionView } | null>(
    null,
  );
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; message?: string; formError?: string }>) =>
    startTransition(async () => {
      const result = await fn();
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
                {product.sku} · {formatCurrency(product.basePriceValue)} base ·{" "}
                {product.isConfigurable ? "configurable" : "fixed specification"}
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
            <ProductForm
              slug={slug}
              categories={categories}
              product={product}
              onSaved={() => setEditing(false)}
            />
          ) : product.description ? (
            <p className="text-sm">{product.description}</p>
          ) : (
            <p className="text-sm text-muted-foreground">No description yet.</p>
          )}
        </section>

        <section className="grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-md font-semibold">Options</h2>
            {canWrite ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setGroupForm(groupForm === "new" ? null : "new")}
              >
                <Plus aria-hidden />
                Add option group
              </Button>
            ) : null}
          </div>

          {groupForm ? (
            <GroupForm
              slug={slug}
              productId={product.id}
              triggers={product.groups
                .filter((g) => HAS_CHOICES.has(g.input))
                .map((g) => ({
                  code: g.code,
                  label: g.label,
                  options: g.options.map((o) => ({ code: o.code, label: o.label })),
                }))}
              group={groupForm === "new" ? undefined : groupForm}
              onDone={(message) => {
                setGroupForm(null);
                setFeedback({ tone: "success", message });
              }}
              onCancel={() => setGroupForm(null)}
            />
          ) : null}

          {product.groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {product.isConfigurable
                ? "This product is marked configurable, so it needs at least one option group before it can be published."
                : "No options — this product is sold as specified."}
            </p>
          ) : (
            <ul className="grid gap-3" aria-label="Option groups">
              {product.groups.map((group) => (
                <li key={group.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="flex items-center gap-2 font-medium">
                        {group.label}
                        <Badge tone="neutral">{INPUT_LABELS[group.input] ?? group.input}</Badge>
                        {group.required ? <Badge tone="warning">required</Badge> : null}
                      </h3>
                      <p className="font-mono text-xs text-muted-foreground">{group.code}</p>
                      {group.visibleWhen ? (
                        <p className="text-xs text-muted-foreground">
                          Asked only when{" "}
                          {product.groups.find((g) => g.code === group.visibleWhen?.group)?.label ??
                            group.visibleWhen.group}{" "}
                          is{" "}
                          {product.groups
                            .find((g) => g.code === group.visibleWhen?.group)
                            ?.options.find((o) => o.code === group.visibleWhen?.equals)?.label ??
                            group.visibleWhen.equals}
                        </p>
                      ) : null}
                    </div>
                    {canWrite ? (
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setGroupForm(group)}>
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={pending}
                          aria-label={`Remove ${group.label}`}
                          onClick={() => run(() => removeGroup(slug, { groupId: group.id }))}
                        >
                          <Trash2 aria-hidden />
                        </Button>
                      </div>
                    ) : null}
                  </div>

                  {group.input === "NUMBER" ? (
                    <p className="text-sm text-muted-foreground">
                      {group.minValue ?? "any"} – {group.maxValue ?? "any"}
                    </p>
                  ) : null}

                  {HAS_CHOICES.has(group.input) ? (
                    <>
                      <ul className="mt-2 grid gap-1">
                        {group.options.map((option) => (
                          <li
                            key={option.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded border px-2 py-1 text-sm"
                          >
                            <span>{option.label}</span>
                            <span className="flex items-center gap-2">
                              <span className="text-muted-foreground">
                                {option.priceDelta !== 0
                                  ? `${option.priceDelta > 0 ? "+" : ""}${formatCurrency(option.priceDelta)}`
                                  : null}
                                {option.pricePctDelta !== 0
                                  ? ` ${option.pricePctDelta > 0 ? "+" : ""}${option.pricePctDelta}%`
                                  : null}
                                {option.priceDelta === 0 && option.pricePctDelta === 0
                                  ? "included"
                                  : null}
                              </span>
                              {canWrite ? (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setOptionForm({ groupId: group.id, option })}
                                  >
                                    Edit
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled={pending}
                                    aria-label={`Remove ${option.label}`}
                                    onClick={() =>
                                      run(() => removeChoice(slug, { optionId: option.id }))
                                    }
                                  >
                                    <Trash2 aria-hidden />
                                  </Button>
                                </>
                              ) : null}
                            </span>
                          </li>
                        ))}
                        {group.options.length === 0 ? (
                          <li className="text-sm text-muted-foreground">
                            Nothing to choose from yet.
                          </li>
                        ) : null}
                      </ul>
                      {canWrite ? (
                        optionForm?.groupId === group.id ? (
                          <OptionForm
                            slug={slug}
                            groupId={group.id}
                            option={optionForm.option}
                            onDone={(message) => {
                              setOptionForm(null);
                              setFeedback({ tone: "success", message });
                            }}
                            onCancel={() => setOptionForm(null)}
                          />
                        ) : (
                          <Button
                            className="mt-2"
                            variant="outline"
                            size="sm"
                            onClick={() => setOptionForm({ groupId: group.id })}
                          >
                            <Plus aria-hidden />
                            Add option
                          </Button>
                        )
                      ) : null}
                    </>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <aside className="grid h-fit gap-4">
        <PricePreview product={product} />

        {canWrite ? (
          <div className="grid gap-2 rounded-lg border p-4">
            <h2 className="text-md font-semibold">Availability</h2>
            <div className="flex flex-wrap gap-2">
              {product.availableActions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Fix the warnings above before publishing.
                </p>
              ) : (
                product.availableActions.map((action) => (
                  <Button
                    key={action}
                    size="sm"
                    variant={action === "publish" ? "primary" : "outline"}
                    disabled={pending}
                    onClick={() => run(() => moveProduct(slug, { productId: product.id, action }))}
                  >
                    {ACTION_LABELS[action] ?? action}
                  </Button>
                ))
              )}
            </div>
            {product.status === "DRAFT" ? (
              <Button
                variant="ghost"
                size="sm"
                className="justify-self-start"
                disabled={pending}
                onClick={() => run(() => removeProduct(slug, { productId: product.id }))}
              >
                <Trash2 aria-hidden />
                Delete draft
              </Button>
            ) : null}
          </div>
        ) : null}
      </aside>
    </div>
  );
}

/**
 * What a customer would pay with these options chosen — the same arithmetic
 * the quote will use, so a price surprise shows up here first.
 */
function PricePreview({ product }: { product: ProductView }) {
  const [chosen, setChosen] = useState<Record<string, string>>({});

  const selected = useMemo(
    () =>
      product.groups
        .flatMap((group) => group.options.filter((o) => chosen[group.id] === o.id))
        .map((o) => ({ priceDelta: o.priceDelta, pricePctDelta: o.pricePctDelta })),
    [chosen, product.groups],
  );
  const unit = unitPriceWithOptions(product.basePriceValue, selected);

  const choosable = product.groups.filter((g) => HAS_CHOICES.has(g.input) && g.options.length > 0);

  return (
    <div className="grid gap-3 rounded-lg border p-4">
      <div>
        <h2 className="text-md font-semibold">Price preview</h2>
        <p className="text-sm text-muted-foreground">
          Base {formatCurrency(product.basePriceValue)}
        </p>
      </div>
      {choosable.map((group) => (
        <div key={group.id} className="grid gap-1.5">
          <label className="text-sm font-medium" htmlFor={`preview-${group.id}`}>
            {group.label}
          </label>
          <NativeSelect
            id={`preview-${group.id}`}
            value={chosen[group.id] ?? ""}
            onChange={(event) => setChosen((prev) => ({ ...prev, [group.id]: event.target.value }))}
          >
            <option value="">— none —</option>
            {group.options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </NativeSelect>
        </div>
      ))}
      <div className="rounded-md bg-surface p-3">
        <p className="text-sm text-muted-foreground">Unit price</p>
        <p className="text-lg font-semibold" data-testid="price-preview">
          {formatCurrency(unit)}
        </p>
      </div>
      <p className="text-xs text-muted-foreground">
        Excludes tax ({product.taxRatePct}%) and any quote-level discount.
      </p>
      <Input type="hidden" value={unit} readOnly aria-hidden tabIndex={-1} className="hidden" />
    </div>
  );
}
