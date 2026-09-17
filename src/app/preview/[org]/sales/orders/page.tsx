import type { Metadata } from "next";

import { PageHeader } from "@/components/data/page-header";
import { PageContainer } from "@/components/layout/page-container";
import { OrdersTable } from "@/features/preview/components/orders-table";
import { sampleOrders } from "@/features/preview/sample-data";

export const metadata: Metadata = { title: "Sales orders" };

export default function OrdersPage() {
  const orders = sampleOrders();
  return (
    <PageContainer width="wide">
      <PageHeader
        title="Sales orders"
        description="Every confirmed and in-flight order. Select rows for bulk actions."
      />
      <OrdersTable orders={orders} />
    </PageContainer>
  );
}
