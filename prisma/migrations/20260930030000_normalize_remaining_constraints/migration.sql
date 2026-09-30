-- Normalize legacy constraint names and defaults so production matches the
-- current Prisma schema metadata.

ALTER TABLE "committee_members" DROP CONSTRAINT IF EXISTS "committee_members_committee_id_fkey";
ALTER TABLE "committee_members" DROP CONSTRAINT IF EXISTS "committee_members_teacher_id_fkey";
ALTER TABLE "defense_committees" DROP CONSTRAINT IF EXISTS "defense_committees_period_id_fkey";
ALTER TABLE "projects" DROP CONSTRAINT IF EXISTS "projects_topic_id_fkey";
ALTER TABLE "scoring_results" DROP CONSTRAINT IF EXISTS "scoring_results_student_id_fkey";
ALTER TABLE "progress_reports" DROP CONSTRAINT IF EXISTS "progress_reports_period_id_fkey";

ALTER TABLE "projects"
  ADD CONSTRAINT "projects_topic_id_fkey"
  FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "committee_members"
  ADD CONSTRAINT "committee_members_committee_id_fkey"
  FOREIGN KEY ("committee_id") REFERENCES "defense_committees"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "committee_members_teacher_id_fkey"
  FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "progress_reports"
  ADD CONSTRAINT "progress_reports_period_id_fkey"
  FOREIGN KEY ("period_id") REFERENCES "registration_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "scoring_results"
  ADD CONSTRAINT "scoring_results_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "faculties" ALTER COLUMN "updated_at" DROP DEFAULT;

ALTER INDEX IF EXISTS "committee_members_committee_id_teacher_id_unique"
  RENAME TO "committee_members_committee_id_teacher_id_key";
ALTER INDEX IF EXISTS "deadline_alert_logs_deadline_id_event_recipient_role_recip_key"
  RENAME TO "deadline_alert_logs_deadline_id_event_recipient_role_recipi_key";

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TemplateType') THEN
    DROP TYPE "TemplateType";
  END IF;
END $$;
