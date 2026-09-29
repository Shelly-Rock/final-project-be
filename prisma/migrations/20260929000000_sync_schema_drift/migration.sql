-- Sync columns introduced in application code after the production database
-- was baselined. All statements are idempotent for partially upgraded DBs.

ALTER TYPE "SubmissionStatus" ADD VALUE IF NOT EXISTS 'APPROVED_BY_TEACHER';

ALTER TABLE "topics" ADD COLUMN IF NOT EXISTS "english_name" VARCHAR(255);

ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "faculty_id" VARCHAR(50);

ALTER TABLE "projects"
  ADD COLUMN IF NOT EXISTS "is_leader" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "assigned_task" TEXT,
  ADD COLUMN IF NOT EXISTS "student_message" TEXT;

ALTER TABLE "period_deadlines" ADD COLUMN IF NOT EXISTS "template_id" INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'students_faculty_id_fkey'
  ) THEN
    ALTER TABLE "students"
      ADD CONSTRAINT "students_faculty_id_fkey"
      FOREIGN KEY ("faculty_id") REFERENCES "faculties"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'period_deadlines_template_id_fkey'
  ) THEN
    ALTER TABLE "period_deadlines"
      ADD CONSTRAINT "period_deadlines_template_id_fkey"
      FOREIGN KEY ("template_id") REFERENCES "report_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "students_faculty_id_idx" ON "students"("faculty_id");
