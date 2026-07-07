-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('MANAGER', 'ORDER_MANAGER', 'SUPPORT', 'CONTENT_EDITOR', 'INVENTORY');

-- AlterTable
ALTER TABLE "users"
    ADD COLUMN "staff_role" "StaffRole",
    ADD COLUMN "invited_by_id" UUID,
    ADD COLUMN "invited_at" TIMESTAMP(3),
    ADD COLUMN "last_seen_at" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "users"
    ADD CONSTRAINT "users_invited_by_id_fkey"
    FOREIGN KEY ("invited_by_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");
