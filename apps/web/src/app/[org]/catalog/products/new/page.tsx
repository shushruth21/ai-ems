import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";

import { PageContainer } from "@/components/layout/page-container";
import { ProductForm } from "@/features/catalog/components/product-form";
import { requireOrgContext } from "@/server/org/context";
import { listCategories } from "@ai-ems/db/catalog/categories";
import { EmptyState } from "@ai-ems/ui/components/data/empty-state";
import { PageHeader } from "@ai-ems/ui/components/data/page-header";
import { Button } from "@ai-ems/ui/components/ui/button";

export const metadata: Metadata = { title: "New product" };

export default async function NewProductPage({ params }: PageProps<"/[org]/catalog/products/new">) {
  const { org } = await params;
  const ctx = await requireOrgContext(org, "catalog.product.write");
  const categories = await listCategories(ctx.db);

  return (
    <PageContainer>
      <PageHeader
        title="New product"
        description="Start as a draft; publish when it's ready to sell."
      />
      {categories.length === 0 ? (
        <EmptyState
          title="Add a category first"
          description="Products live in categories, so the catalog stays navigable as it grows."
          action={
            <Button asChild>
              <Link href={`/${org}/catalog/categories` as Route}>Add a category</Link>
            </Button>
          }
        />
      ) : (
        <ProductForm slug={org} categories={categories.map((c) => ({ id: c.id, name: c.name }))} />
      )}
    </PageContainer>
  );
}
