import type { Metadata } from "next";

import { PageContainer } from "@/components/layout/page-container";
import { CategoriesManager } from "@/features/catalog/components/categories-manager";
import { getOrgContext, hasPermission } from "@/server/org/context";
import { listCategories } from "@ai-ems/db/catalog/categories";
import { PageHeader } from "@ai-ems/ui/components/data/page-header";

export const metadata: Metadata = { title: "Categories" };

export default async function CategoriesPage({ params }: PageProps<"/[org]/catalog/categories">) {
  const { org } = await params;
  const ctx = await getOrgContext(org);
  const categories = await listCategories(ctx.db);

  return (
    <PageContainer width="wide">
      <PageHeader
        title="Categories"
        description="How the catalog is organised — seating, tables, storage."
      />
      <CategoriesManager
        slug={org}
        canWrite={hasPermission(ctx, "catalog.product.write")}
        categories={categories}
      />
    </PageContainer>
  );
}
