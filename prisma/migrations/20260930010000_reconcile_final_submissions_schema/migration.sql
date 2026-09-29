-- Reconcile the legacy final_submissions shape with the current Prisma model.
-- The legacy production table used student_id/project_id; the application now
-- uses submitted_by_student_id/topic_id.

ALTER TABLE "final_submissions"
  ADD COLUMN IF NOT EXISTS "topic_id" INTEGER,
  ADD COLUMN IF NOT EXISTS "submitted_by_student_id" INTEGER;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'final_submissions' AND column_name = 'project_id'
  ) THEN
    UPDATE "final_submissions" fs
    SET "topic_id" = p."topic_id"
    FROM "projects" p
    WHERE fs."project_id" = p."id" AND fs."topic_id" IS NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'final_submissions' AND column_name = 'student_id'
  ) THEN
    UPDATE "final_submissions" fs
    SET "submitted_by_student_id" = fs."student_id"
    WHERE fs."submitted_by_student_id" IS NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM "final_submissions" WHERE "topic_id" IS NULL)
     OR EXISTS (SELECT 1 FROM "final_submissions" WHERE "submitted_by_student_id" IS NULL) THEN
    RAISE EXCEPTION 'Cannot reconcile final_submissions: unmapped topic or student rows remain';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "final_submissions"
    GROUP BY "topic_id" HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot reconcile final_submissions: duplicate topic_id values remain';
  END IF;
END $$;

ALTER TABLE "final_submissions"
  ALTER COLUMN "topic_id" SET NOT NULL,
  ALTER COLUMN "submitted_by_student_id" SET NOT NULL;

ALTER TABLE "final_submissions"
  DROP CONSTRAINT IF EXISTS "final_submissions_project_id_fkey",
  DROP CONSTRAINT IF EXISTS "final_submissions_student_id_fkey";

DROP INDEX IF EXISTS "final_submissions_project_id_idx";
DROP INDEX IF EXISTS "final_submissions_project_id_key";
DROP INDEX IF EXISTS "final_submissions_student_id_key";

ALTER TABLE "final_submissions"
  DROP COLUMN IF EXISTS "project_id",
  DROP COLUMN IF EXISTS "student_id";

ALTER TABLE "final_submissions"
  ADD CONSTRAINT "final_submissions_topic_id_fkey"
    FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "final_submissions_submitted_by_student_id_fkey"
    FOREIGN KEY ("submitted_by_student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "final_submissions_topic_id_key"
  ON "final_submissions"("topic_id");
CREATE INDEX IF NOT EXISTS "final_submissions_topic_id_idx"
  ON "final_submissions"("topic_id");
