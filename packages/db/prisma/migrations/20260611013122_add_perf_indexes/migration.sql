-- CreateIndex
CREATE INDEX "orders_status_placed_at_idx" ON "orders"("status", "placed_at");

-- CreateIndex
CREATE INDEX "testimonials_status_sort_order_idx" ON "testimonials"("status", "sort_order");
