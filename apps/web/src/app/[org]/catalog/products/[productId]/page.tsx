import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageContainer } from "@/components/layout/page-container";
import { ProductWorkspace } from "@/features/catalog/components/product-workspace";
import { getOrgContext, hasPermission } from "@/server/org/context";
import { listCategories } from "@ai-ems/db/catalog/categories";
import { getProduct } from "@ai-ems/db/catalog/products";
import { PageHeader } from "@ai-ems/ui/components/data/page-header";
import { StatusBadge } from "@ai-ems/ui/components/data/status-badge";

export const metadata: Metadata = { title: "Product" };

export default async function ProductPage({
  params,
}: PageProps<"/[org]/catalog/products/[productId]">) {
  const { org, productId } = await params;
  const ctx = await getOrgContext(org);
  const [product, categories] = await Promise.all([
    getProduct(ctx.db, productId),
    listCategories(ctx.db),
  ]);
  if (!product) notFound();

  return (
    <PageContainer width="wide">
      <PageHeader
        title={product.name}
        description={`${product.sku} · ${product.categoryName}`}
        actions={<StatusBadge status={product.status} />}
      />
      <ProductWorkspace
        slug={org}
        canWrite={hasPermission(ctx, "catalog.product.write")}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        product={{
          id: product.id,
          sku: product.sku,
          name: product.name,
          description: product.description ?? "",
          categoryId: product.categoryId,
          basePrice: String(product.basePrice),
          basePriceValue: product.basePrice,
          taxRatePct: String(product.taxRatePct),
          leadTimeDays: String(product.leadTimeDays),
          isConfigurable: product.isConfigurable,
          status: product.status,
          availableActions: product.availableActions,
          groups: product.groups.map((group) => ({
            id: group.id,
            code: group.code,
            label: group.label,
            input: group.input,
            required: group.required,
            minValue: group.minValue,
            maxValue: group.maxValue,
            sortOrder: group.sortOrder,
            options: group.options.map((option) => ({
              id: option.id,
              label: option.label,
              priceDelta: option.priceDelta,
              pricePctDelta: option.pricePctDelta,
            })),
          })),
        }}
      />
    </PageContainer>
  );
}
