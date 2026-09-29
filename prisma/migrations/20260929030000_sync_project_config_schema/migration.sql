-- Align legacy production tables/enums with project configuration and
-- progress-template models.
ALTER TYPE "DeadlineType" ADD VALUE IF NOT EXISTS 'SECRETARY_REVIEW';
ALTER TYPE "DeadlineType" ADD VALUE IF NOT EXISTS 'FORM_02';

ALTER TABLE "report_templates"
  ADD COLUMN IF NOT EXISTS "period_id" INTEGER,
  ADD COLUMN IF NOT EXISTS "is_cloned" BOOLEAN NOT NULL DEFAULT false;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'report_templates'
      AND column_name = 'type'
  ) THEN
    ALTER TABLE "report_templates" ALTER COLUMN "type" DROP NOT NULL;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'report_templates'
      AND column_name = 'teacher_id'
  ) THEN
    ALTER TABLE "report_templates" ALTER COLUMN "teacher_id" DROP NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'report_templates_period_id_fkey'
  ) THEN
    ALTER TABLE "report_templates"
      ADD CONSTRAINT "report_templates_period_id_fkey"
      FOREIGN KEY ("period_id") REFERENCES "registration_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "report_templates_period_id_idx"
  ON "report_templates"("period_id");
