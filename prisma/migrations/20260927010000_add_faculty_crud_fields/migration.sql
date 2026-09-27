-- Add basic CRUD fields for faculties
ALTER TABLE "faculties"
ADD COLUMN "description" TEXT,
ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
