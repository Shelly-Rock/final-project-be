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
ALTER TABLE "report_templates" ADD COLUMN IF NOT EXISTS "faculty_id" VARCHAR(50);

-- Keep production in sync with Prisma fields added after the original
-- migrations were baselined. These columns are read by the student, scoring,
-- and governance endpoints.
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
