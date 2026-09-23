"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";

import { FormFeedback } from "@/components/forms/form-feedback";
import { useActionForm } from "@/lib/use-action-form";
import { productSchema } from "@ai-ems/contracts/catalog";
import { skuFromName } from "@ai-ems/domain/catalog/product-policy";
import { Button } from "@ai-ems/ui/components/ui/button";
import { Checkbox } from "@ai-ems/ui/components/ui/checkbox";
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
import { Textarea } from "@ai-ems/ui/components/ui/textarea";

import { editProduct, newProduct } from "../actions";

export interface CategoryOption {
  id: string;
  name: string;
}

export interface ProductFormValues {
  id?: string;
  sku: string;
  name: string;
  description: string;
  categoryId: string;
  basePrice: string;
  taxRatePct: string;
  leadTimeDays: string;
  isConfigurable: boolean;
}

type Values = z.input<typeof productSchema>;

export function ProductForm({
  slug,
  product,
  categories,
  onSaved,
}: {
  slug: string;
  product?: ProductFormValues;
  categories: CategoryOption[];
  onSaved?: () => void;
}) {
  const form = useForm<Values, unknown, z.output<typeof productSchema>>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      sku: product?.sku ?? "",
      name: product?.name ?? "",
      description: product?.description ?? "",
      categoryId: product?.categoryId ?? categories[0]?.id ?? "",
      basePrice: product?.basePrice ?? "",
      taxRatePct: product?.taxRatePct ?? "0",
      leadTimeDays: product?.leadTimeDays ?? "0",
      isConfigurable: product?.isConfigurable ?? false,
    },
  });
  const { onSubmit, pending, feedback } = useActionForm(
    form,
    (values) => (product?.id ? editProduct(slug, product.id, values) : newProduct(slug, values)),
    { onSuccess: () => onSaved?.() },
  );

  return (
    <Form {...form}>
      <form
        onSubmit={onSubmit}
        method="post"
        noValidate
        className="grid gap-4"
        aria-label={product?.id ? "Edit product" : "New product"}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Product name</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Three-seat sofa"
                    {...field}
                    onChange={(event) => {
                      field.onChange(event);
                      // The SKU follows the name until someone edits it themselves.
                      if (!form.formState.dirtyFields.sku) {
                        form.setValue("sku", skuFromName(event.target.value));
                      }
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="sku"
            render={({ field }) => (
              <FormItem>
                <FormLabel>SKU</FormLabel>
                <FormControl>
                  <Input placeholder="SOFA-3S" className="font-mono" {...field} />
                </FormControl>
                <FormDescription>How this product is referred to everywhere else.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="categoryId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Category</FormLabel>
                <FormControl>
                  <NativeSelect {...field}>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
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
            name="basePrice"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Base price</FormLabel>
                <FormControl>
                  <Input inputMode="decimal" placeholder="1200" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="taxRatePct"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tax rate (%)</FormLabel>
                <FormControl>
                  <Input inputMode="decimal" placeholder="7.5" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="leadTimeDays"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Lead time (days)</FormLabel>
                <FormControl>
                  <Input type="number" min={0} max={365} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea rows={3} {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="isConfigurable"
          render={({ field }) => (
            <FormItem>
              <label className="flex items-start gap-2 text-sm">
                <FormControl>
                  <Checkbox
                    checked={field.value ?? false}
                    onCheckedChange={(value) => field.onChange(value === true)}
                  />
                </FormControl>
                <span>
                  People choose options for this product
                  <span className="block text-muted-foreground">
                    Fabric, size, finish — anything that changes the price.
                  </span>
                </span>
              </label>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormFeedback feedback={feedback} />
        <div>
          <Button type="submit" loading={pending}>
            {product?.id ? "Save product" : "Create product"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
