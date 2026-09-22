"use client";

import { Copy, KeyRound } from "lucide-react";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";

import { FormFeedback } from "@/components/forms/form-feedback";
import { useActionForm, type FormFeedback as Feedback } from "@/lib/use-action-form";
import { API_KEY_SCOPES, createApiKeySchema } from "@ai-ems/contracts/platform";
import { Badge } from "@ai-ems/ui/components/ui/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@ai-ems/ui/components/ui/table";

import { createKey, revokeKey, type NewApiKey } from "../actions";

export interface ApiKeyView {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

type Values = z.input<typeof createApiKeySchema>;

const day = (value: string | null) => (value ? new Date(value).toLocaleDateString() : "—");

export function ApiKeysManager({ slug, keys }: { slug: string; keys: ApiKeyView[] }) {
  const [issued, setIssued] = useState<NewApiKey | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="grid gap-6">
      <CreateKeyForm
        slug={slug}
        onCreated={(key) => {
          setIssued(key);
          setFeedback(null);
        }}
      />
      <FormFeedback feedback={feedback} />
      {issued ? <IssuedKey issued={issued} /> : null}

      <div
        className="overflow-x-auto rounded-lg border"
        role="region"
        tabIndex={0}
        aria-label="API keys"
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Key</TableHead>
              <TableHead>Scopes</TableHead>
              <TableHead>Last used</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {keys.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground">
                  No keys yet.
                </TableCell>
              </TableRow>
            ) : (
              keys.map((key) => (
                <TableRow key={key.id}>
                  <TableCell className="font-medium">{key.name}</TableCell>
                  <TableCell className="font-mono text-sm">aiems_{key.prefix}…</TableCell>
                  <TableCell>
                    {key.scopes.map((scope) => (
                      <Badge key={scope} tone="neutral" className="mr-1">
                        {scope}
                      </Badge>
                    ))}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {day(key.lastUsedAt)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {day(key.expiresAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    {key.revokedAt ? (
                      <Badge tone="warning">revoked</Badge>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        aria-label={`Revoke ${key.name}`}
                        onClick={() =>
                          startTransition(async () => {
                            const result = await revokeKey(slug, { apiKeyId: key.id });
                            setFeedback(
                              result.ok
                                ? { tone: "success", message: result.message ?? "Key revoked." }
                                : {
                                    tone: "danger",
                                    message: result.formError ?? "That didn't work.",
                                  },
                            );
                          })
                        }
                      >
                        Revoke
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function CreateKeyForm({ slug, onCreated }: { slug: string; onCreated: (key: NewApiKey) => void }) {
  const form = useForm<Values, unknown, z.output<typeof createApiKeySchema>>({
    resolver: zodResolver(createApiKeySchema),
    defaultValues: { name: "", scopes: ["read"], expiresInDays: "90" },
  });
  const { onSubmit, pending, feedback } = useActionForm(form, (values) => createKey(slug, values), {
    onSuccess: (result) => {
      if (result.data) onCreated(result.data);
      form.reset({ name: "", scopes: ["read"], expiresInDays: "90" });
    },
  });

  return (
    <Form {...form}>
      <form
        onSubmit={onSubmit}
        noValidate
        className="grid gap-3 rounded-lg border p-4 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end"
        aria-label="Create an API key"
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Key name</FormLabel>
              <FormControl>
                <Input placeholder="Warehouse scanner" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="scopes"
          render={({ field }) => {
            const selected = new Set(field.value ?? []);
            return (
              <FormItem>
                <FormLabel>Scopes</FormLabel>
                <div className="flex gap-3">
                  {API_KEY_SCOPES.map((scope) => (
                    <label key={scope} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={selected.has(scope)}
                        onCheckedChange={(value) => {
                          const next = new Set(selected);
                          if (value === true) next.add(scope);
                          else next.delete(scope);
                          field.onChange([...next]);
                        }}
                      />
                      {scope}
                    </label>
                  ))}
                </div>
                <FormMessage />
              </FormItem>
            );
          }}
        />
        <FormField
          control={form.control}
          name="expiresInDays"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Expires in (days)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={1}
                  max={365}
                  className="sm:w-36"
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" loading={pending}>
          <KeyRound aria-hidden />
          Create key
        </Button>
        <div className="sm:col-span-4">
          <FormFeedback feedback={feedback} />
        </div>
      </form>
    </Form>
  );
}

/** Shown once: the secret half of the key is never stored in readable form. */
function IssuedKey({ issued }: { issued: NewApiKey }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="grid gap-2 rounded-lg border bg-surface p-3">
      <p className="text-sm text-muted-foreground">
        Copy <span className="font-medium text-foreground">{issued.name}</span> now — it is shown
        once and can&apos;t be recovered.
      </p>
      <div className="flex min-w-0 items-center gap-2">
        <code
          data-testid="api-key-token"
          className="min-w-0 flex-1 truncate rounded bg-muted px-2 py-1 font-mono text-sm"
        >
          {issued.token}
        </code>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            void navigator.clipboard?.writeText(issued.token).then(() => setCopied(true))
          }
        >
          <Copy aria-hidden />
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </div>
  );
}
