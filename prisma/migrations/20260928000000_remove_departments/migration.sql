-- Collapse the old faculty -> department hierarchy to a faculty-only model.
-- Existing department assignments are preserved by copying their faculty_id.

ALTER TABLE "teachers"
  ADD COLUMN IF NOT EXISTS "faculty_id" VARCHAR(50);

DO $$
BEGIN
  IF to_regclass('public.departments') IS NOT NULL THEN
    EXECUTE 'UPDATE "teachers" t
      SET "faculty_id" = d."faculty_id"
      FROM "departments" d
      WHERE t."department_id" = d."id"
        AND t."faculty_id" IS NULL';
  END IF;
END $$;

ALTER TABLE "secretaries"
  ADD COLUMN IF NOT EXISTS "faculty_id" VARCHAR(50);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'secretaries'
      AND column_name = 'department_id'
  ) THEN
    EXECUTE 'UPDATE "secretaries" s
      SET "faculty_id" = d."faculty_id"
      FROM "departments" d
      WHERE s."department_id" = d."id"
        AND s."faculty_id" IS NULL';
  END IF;
END $$;

ALTER TABLE "report_templates"
  ADD COLUMN IF NOT EXISTS "faculty_id" VARCHAR(50);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'report_templates'
      AND column_name = 'department_id'
  ) THEN
    EXECUTE 'UPDATE "report_templates" r
      SET "faculty_id" = d."faculty_id"
      FROM "departments" d
      WHERE r."department_id" = d."id"
        AND r."faculty_id" IS NULL';
  END IF;
END $$;

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

ALTER TABLE "teachers" DROP CONSTRAINT IF EXISTS "teachers_department_id_fkey";
ALTER TABLE "secretaries" DROP CONSTRAINT IF EXISTS "secretaries_department_id_fkey";
ALTER TABLE "secretaries" DROP CONSTRAINT IF EXISTS "secretaries_department_id_key";
ALTER TABLE "report_templates" DROP CONSTRAINT IF EXISTS "report_templates_department_id_fkey";

ALTER TABLE "teachers" DROP COLUMN IF EXISTS "department_id";
ALTER TABLE "secretaries" DROP COLUMN IF EXISTS "department_id";
ALTER TABLE "report_templates" DROP COLUMN IF EXISTS "department_id";

DROP INDEX IF EXISTS "teachers_department_id_idx";
DROP INDEX IF EXISTS "secretaries_department_id_key";
DROP INDEX IF EXISTS "report_templates_department_id_idx";

ALTER TABLE "teachers"
  DROP CONSTRAINT IF EXISTS "teachers_faculty_id_fkey",
  ADD CONSTRAINT "teachers_faculty_id_fkey"
    FOREIGN KEY ("faculty_id") REFERENCES "faculties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "secretaries"
  DROP CONSTRAINT IF EXISTS "secretaries_faculty_id_key",
  DROP CONSTRAINT IF EXISTS "secretaries_faculty_id_fkey",
  ADD CONSTRAINT "secretaries_faculty_id_key" UNIQUE ("faculty_id"),
  ADD CONSTRAINT "secretaries_faculty_id_fkey"
    FOREIGN KEY ("faculty_id") REFERENCES "faculties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "report_templates"
  DROP CONSTRAINT IF EXISTS "report_templates_faculty_id_fkey",
  ADD CONSTRAINT "report_templates_faculty_id_fkey"
    FOREIGN KEY ("faculty_id") REFERENCES "faculties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "report_templates_faculty_id_idx" ON "report_templates"("faculty_id");

DROP TABLE IF EXISTS "departments";
