-- Add missing JSON column used by the Teacher Prisma model.
ALTER TABLE "teachers" ADD COLUMN IF NOT EXISTS "extra_data" JSONB;
