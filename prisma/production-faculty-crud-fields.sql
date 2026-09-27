-- Idempotent production patch for Faculty CRUD fields.
-- The production database existed before Prisma migrations were baselined,
-- so this patch avoids `prisma migrate deploy` P3005 on non-empty databases.
ALTER TABLE "faculties"
ADD COLUMN IF NOT EXISTS "description" TEXT,
ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
