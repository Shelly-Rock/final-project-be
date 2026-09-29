-- Idempotent production patch for Faculty CRUD fields.
-- The production database existed before Prisma migrations were baselined,
-- so this patch avoids `prisma migrate deploy` P3005 on non-empty databases.
ALTER TABLE "faculties"
ADD COLUMN IF NOT EXISTS "description" TEXT,
ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Faculty-only organization model. This is idempotent for databases that were
-- provisioned before the Prisma migration history was introduced.
ALTER TABLE "teachers" ADD COLUMN IF NOT EXISTS "faculty_id" VARCHAR(50);
ALTER TABLE "secretaries" ADD COLUMN IF NOT EXISTS "faculty_id" VARCHAR(50);
ALTER TABLE "report_templates"
  ADD COLUMN IF NOT EXISTS "faculty_id" VARCHAR(50),
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

-- Fields/enums introduced after the original production schema baseline.
ALTER TYPE "SubmissionStatus" ADD VALUE IF NOT EXISTS 'APPROVED_BY_TEACHER';
ALTER TYPE "DeadlineType" ADD VALUE IF NOT EXISTS 'SECRETARY_REVIEW';
ALTER TYPE "DeadlineType" ADD VALUE IF NOT EXISTS 'FORM_02';
ALTER TABLE "topics"
  ADD COLUMN IF NOT EXISTS "english_name" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "objectives" TEXT,
  ADD COLUMN IF NOT EXISTS "technologies" TEXT;

-- Keep production in sync with Prisma fields added after the original
-- migrations were baselined. These columns are read by the student, scoring,
-- and governance endpoints.
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "faculty_id" VARCHAR(50);
ALTER TABLE "students"
  ALTER COLUMN "date_of_birth" DROP NOT NULL,
  ALTER COLUMN "gender" DROP NOT NULL;
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

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'report_templates_period_id_fkey'
  ) THEN
    ALTER TABLE "report_templates"
      ADD CONSTRAINT "report_templates_period_id_fkey"
      FOREIGN KEY ("period_id") REFERENCES "registration_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "students_faculty_id_idx" ON "students"("faculty_id");
CREATE INDEX IF NOT EXISTS "report_templates_period_id_idx" ON "report_templates"("period_id");

DO $$
BEGIN
  IF to_regclass('public.departments') IS NOT NULL THEN
    EXECUTE 'UPDATE "teachers" t SET "faculty_id" = d."faculty_id" FROM "departments" d WHERE t."department_id" = d."id" AND t."faculty_id" IS NULL';
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'students' AND column_name = 'department_id') THEN
      EXECUTE 'UPDATE "students" s SET "faculty_id" = d."faculty_id" FROM "departments" d WHERE s."department_id" = d."id" AND s."faculty_id" IS NULL';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'secretaries' AND column_name = 'department_id') THEN
      EXECUTE 'UPDATE "secretaries" s SET "faculty_id" = d."faculty_id" FROM "departments" d WHERE s."department_id" = d."id" AND s."faculty_id" IS NULL';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'report_templates' AND column_name = 'department_id') THEN
      EXECUTE 'UPDATE "report_templates" r SET "faculty_id" = d."faculty_id" FROM "departments" d WHERE r."department_id" = d."id" AND r."faculty_id" IS NULL';
    END IF;
  END IF;
END $$;

ALTER TABLE "teachers" DROP CONSTRAINT IF EXISTS "teachers_department_id_fkey";
ALTER TABLE "secretaries" DROP CONSTRAINT IF EXISTS "secretaries_department_id_fkey";
ALTER TABLE "secretaries" DROP CONSTRAINT IF EXISTS "secretaries_department_id_key";
ALTER TABLE "report_templates" DROP CONSTRAINT IF EXISTS "report_templates_department_id_fkey";
ALTER TABLE "teachers" DROP COLUMN IF EXISTS "department_id";
ALTER TABLE "secretaries" DROP COLUMN IF EXISTS "department_id";
ALTER TABLE "report_templates" DROP COLUMN IF EXISTS "department_id";
DROP TABLE IF EXISTS "departments";

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'registration_periods' AND column_name = 'department_student_limits')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'registration_periods' AND column_name = 'faculty_student_limits') THEN
    ALTER TABLE "registration_periods" RENAME COLUMN "department_student_limits" TO "faculty_student_limits";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'topic_code_sequences' AND column_name = 'dept_code')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'topic_code_sequences' AND column_name = 'faculty_code') THEN
    ALTER TABLE "topic_code_sequences" RENAME COLUMN "dept_code" TO "faculty_code";
  END IF;
END $$;
