-- Product package dimensions for Shiprocket courier rate quotes.
-- All three columns are nullable: existing rows have no data and the
-- shipping service falls back to category-level defaults when missing.
ALTER TABLE "products"
  ADD COLUMN "length_cm"  DECIMAL(6, 2),
  ADD COLUMN "breadth_cm" DECIMAL(6, 2),
  ADD COLUMN "height_cm"  DECIMAL(6, 2);

-- Shiprocket's internal order id (distinct from our orderNumber). We
-- need it to call /orders/cancel via their API. shipmentId already
-- exists for the AWB-tied side of their data model.
ALTER TABLE "order_shipping"
  ADD COLUMN "shiprocket_order_id" TEXT;
