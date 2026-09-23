import type { Metadata } from "next";

import { PageContainer } from "@/components/layout/page-container";
import { FormFeedback } from "@/components/forms/form-feedback";
import { ProductsTable } from "@/features/catalog/components/products-table";
import { getOrgContext, hasPermission } from "@/server/org/context";
import { listProducts } from "@ai-ems/db/catalog/products";
import { PageHeader } from "@ai-ems/ui/components/data/page-header";

export const metadata: Metadata = { title: "Products" };

export default async function ProductsPage({
  params,
  searchParams,
}: PageProps<"/[org]/catalog/products">) {
  const { org } = await params;
  const ctx = await getOrgContext(org);
  const query = await searchParams;
  const products = await listProducts(ctx.db);

  return (
    <PageContainer width="wide">
      <PageHeader
        title="Products"
        description="What you sell: a price, a lead time, and the options people choose from."
      />
      {query.deleted === "1" ? (
        <FormFeedback feedback={{ tone: "success", message: "Draft product deleted." }} />
      ) : null}
      <ProductsTable
        slug={org}
        canWrite={hasPermission(ctx, "catalog.product.write")}
        products={products.map((product) => ({
          id: product.id,
          sku: product.sku,
          name: product.name,
          status: product.status,
          categoryName: product.categoryName,
          basePrice: product.basePrice,
          leadTimeDays: product.leadTimeDays,
          isConfigurable: product.isConfigurable,
          optionGroupCount: product.optionGroupCount,
        }))}
      />
    </PageContainer>
  );
}
