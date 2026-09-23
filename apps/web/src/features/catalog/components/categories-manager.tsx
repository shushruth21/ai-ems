"use client";

import { FolderTree, Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";

import { FormFeedback } from "@/components/forms/form-feedback";
import { useActionForm, type FormFeedback as Feedback } from "@/lib/use-action-form";
import { categorySchema } from "@ai-ems/contracts/catalog";
import { Button } from "@ai-ems/ui/components/ui/button";
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

import { editCategory, newCategory, removeCategory } from "../actions";

export interface CategoryView {
  id: string;
  code: string;
  name: string;
  parentId: string | null;
  parentName: string | null;
  sortOrder: number;
  productCount: number;
}

type Values = z.input<typeof categorySchema>;

export function CategoriesManager({
  slug,
  categories,
  canWrite,
}: {
  slug: string;
  categories: CategoryView[];
  canWrite: boolean;
}) {
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [pending, startTransition] = useTransition();
  const editing = categories.find((c) => c.id === editingId);

  return (
    <div className="grid gap-4">
      {canWrite ? (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setEditingId(editingId === "new" ? null : "new")}>
            <Plus aria-hidden />
            New category
          </Button>
        </div>
      ) : null}

      <FormFeedback feedback={feedback} />

      {editingId ? (
        <CategoryForm
          slug={slug}
          category={editing}
          categories={categories.filter((c) => c.id !== editingId)}
          onDone={(message) => {
            setEditingId(null);
            setFeedback({ tone: "success", message });
          }}
          onCancel={() => setEditingId(null)}
        />
      ) : null}

      {categories.length === 0 ? (
        <EmptyState
          icon={FolderTree}
          title="No categories yet"
          description="Group what you sell — seating, tables, storage — so the catalog stays navigable."
        />
      ) : (
        <div
          className="overflow-x-auto rounded-lg border"
          role="region"
          tabIndex={0}
          aria-label="Categories"
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Inside</TableHead>
                <TableHead className="text-right">Products</TableHead>
                {canWrite ? <TableHead className="text-right">Actions</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((category) => (
                <TableRow key={category.id}>
                  <TableCell className="font-medium">{category.name}</TableCell>
                  <TableCell className="font-mono text-xs">{category.code}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {category.parentName ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">{category.productCount}</TableCell>
                  {canWrite ? (
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        onClick={() => setEditingId(category.id)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        aria-label={`Remove ${category.name}`}
                        onClick={() =>
                          startTransition(async () => {
                            const result = await removeCategory(slug, {
                              categoryId: category.id,
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
                        Remove
                      </Button>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function CategoryForm({
  slug,
  category,
  categories,
  onDone,
  onCancel,
}: {
  slug: string;
  category?: CategoryView;
  categories: CategoryView[];
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  const form = useForm<Values, unknown, z.output<typeof categorySchema>>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      code: category?.code ?? "",
      name: category?.name ?? "",
      parentId: category?.parentId ?? "",
      sortOrder: String(category?.sortOrder ?? 0),
    },
  });
  const { onSubmit, pending, feedback } = useActionForm(
    form,
    (values) => (category ? editCategory(slug, category.id, values) : newCategory(slug, values)),
    { onSuccess: (result) => onDone(result.message ?? "Saved.") },
  );

  return (
    <Form {...form}>
      <form
        onSubmit={onSubmit}
        method="post"
        noValidate
        className="grid gap-3 rounded-lg border p-4 sm:grid-cols-3"
        aria-label={category ? `Edit ${category.name}` : "New category"}
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="Seating" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="code"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Code</FormLabel>
              <FormControl>
                <Input placeholder="SEATING" className="font-mono" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="parentId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Inside</FormLabel>
              <FormControl>
                <NativeSelect {...field} value={field.value ?? ""}>
                  <option value="">Top level</option>
                  {categories.map((parent) => (
                    <option key={parent.id} value={parent.id}>
                      {parent.name}
                    </option>
                  ))}
                </NativeSelect>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="sm:col-span-3">
          <FormFeedback feedback={feedback} />
        </div>
        <div className="flex gap-2 sm:col-span-3">
          <Button type="submit" loading={pending}>
            {category ? "Save category" : "Create category"}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  );
}
