-- Reconcile columns introduced by progress tracking after the original table
-- was created. This runs before constraint normalization so migrate reset can
-- create the period_id foreign key from a clean database.

ALTER TABLE "progress_reports"
  ADD COLUMN IF NOT EXISTS "period_id" INTEGER,
  ADD COLUMN IF NOT EXISTS "deadline_id" INTEGER,
  ADD COLUMN IF NOT EXISTS "missing_marked_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "archived_by" INTEGER,
  ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMP(3);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'progress_reports_period_id_fkey'
  ) THEN
    ALTER TABLE "progress_reports"
      ADD CONSTRAINT "progress_reports_period_id_fkey"
      FOREIGN KEY ("period_id") REFERENCES "registration_periods"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'progress_reports_deadline_id_fkey'
  ) THEN
    ALTER TABLE "progress_reports"
      ADD CONSTRAINT "progress_reports_deadline_id_fkey"
      FOREIGN KEY ("deadline_id") REFERENCES "period_deadlines"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "progress_reports_period_id_idx"
  ON "progress_reports"("period_id");
CREATE INDEX IF NOT EXISTS "progress_reports_deadline_id_idx"
  ON "progress_reports"("deadline_id");
CREATE UNIQUE INDEX IF NOT EXISTS "progress_reports_student_id_deadline_id_key"
  ON "progress_reports"("student_id", "deadline_id");
