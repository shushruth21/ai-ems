-- CreateTable
CREATE TABLE "saved_configurations" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "lead_id" TEXT,
    "name" TEXT NOT NULL,
    "answers" JSONB NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(14,2) NOT NULL,
    "total" DECIMAL(14,2) NOT NULL,
    "price_breakdown" JSONB,
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saved_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "saved_configurations_organization_id_product_id_idx" ON "saved_configurations"("organization_id", "product_id");

-- CreateIndex
CREATE INDEX "saved_configurations_organization_id_lead_id_idx" ON "saved_configurations"("organization_id", "lead_id");

-- AddForeignKey
ALTER TABLE "saved_configurations" ADD CONSTRAINT "saved_configurations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_configurations" ADD CONSTRAINT "saved_configurations_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_configurations" ADD CONSTRAINT "saved_configurations_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
