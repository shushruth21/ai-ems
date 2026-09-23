"use client";

import type { Route } from "next";
import Link from "next/link";
import { Settings2, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";

import { FormFeedback } from "@/components/forms/form-feedback";
import type { FormFeedback as Feedback } from "@/lib/use-action-form";
import { Button } from "@ai-ems/ui/components/ui/button";
import { formatCurrency } from "@ai-ems/ui/lib/format";

import { removeConfiguration } from "../actions";

export interface ConfigurationView {
  id: string;
  name: string;
  productId: string;
  productName: string;
  productSku: string;
  leadId: string | null;
  leadTitle: string | null;
  summary: string[];
  quantity: number;
  unitPrice: number;
  total: number;
  createdAt: string;
}

/**
 * Configurations saved against a product or a lead. Each one is a quote line
 * waiting to happen — the answers and the price are already settled.
 */
export function SavedConfigurations({
  slug,
  configurations,
  canWrite,
  showProduct = false,
  configureHref,
}: {
  slug: string;
  configurations: ConfigurationView[];
  canWrite: boolean;
  /** On a lead, the product name matters; on a product page it's obvious. */
  showProduct?: boolean;
  configureHref?: string;
}) {
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [pending, startTransition] = useTransition();
  const total = configurations.reduce((sum, c) => sum + c.total, 0);

  return (
    <section className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-md font-semibold">
          Configurations
          {configurations.length > 0 ? (
            <span className="ml-2 font-normal text-muted-foreground">
              {configurations.length} · {formatCurrency(total)}
            </span>
          ) : null}
        </h2>
        {canWrite && configureHref ? (
          <Button asChild size="sm" variant="outline">
            <Link href={configureHref as Route}>
              <Settings2 aria-hidden />
              Configure
            </Link>
          </Button>
        ) : null}
      </div>

      <FormFeedback feedback={feedback} />

      {configurations.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nothing configured yet — a saved configuration keeps the answers and the price together.
        </p>
      ) : (
        <ul className="grid gap-2" aria-label="Saved configurations">
          {configurations.map((configuration) => (
            <li key={configuration.id} className="rounded-lg border p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium">{configuration.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {showProduct ? `${configuration.productName} · ` : null}
                    {configuration.quantity} × {formatCurrency(configuration.unitPrice)}
                    {configuration.leadTitle && !showProduct
                      ? ` · ${configuration.leadTitle}`
                      : null}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{formatCurrency(configuration.total)}</span>
                  {canWrite ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      aria-label={`Remove ${configuration.name}`}
                      onClick={() =>
                        startTransition(async () => {
                          const result = await removeConfiguration(slug, {
                            configurationId: configuration.id,
                          });
                          setFeedback(
                            result.ok
                              ? { tone: "success", message: result.message ?? "Removed." }
                              : {
                                  tone: "danger",
                                  message: result.formError ?? "That didn't work.",
                                },
                          );
                        })
                      }
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  ) : null}
                </div>
              </div>
              {configuration.summary.length > 0 ? (
                <ul className="mt-1 grid gap-0.5 text-sm text-muted-foreground">
                  {configuration.summary.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
