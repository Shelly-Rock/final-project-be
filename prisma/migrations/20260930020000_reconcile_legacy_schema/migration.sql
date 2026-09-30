-- Remove legacy columns left behind by older migrations and create the
-- notification drafts table required by the current Prisma schema.

ALTER TABLE "students" DROP CONSTRAINT IF EXISTS "students_teacher_id_fkey";
ALTER TABLE "students" DROP COLUMN IF EXISTS "teacher_id";

ALTER TABLE "defense_committees"
  DROP CONSTRAINT IF EXISTS "defense_committees_chairman_id_fkey",
  DROP CONSTRAINT IF EXISTS "defense_committees_secretary_id_fkey",
  DROP CONSTRAINT IF EXISTS "defense_committees_internal_1_id_fkey",
  DROP CONSTRAINT IF EXISTS "defense_committees_internal_2_id_fkey";
ALTER TABLE "defense_committees"
  DROP COLUMN IF EXISTS "chairman_id",
  DROP COLUMN IF EXISTS "secretary_id",
  DROP COLUMN IF EXISTS "internal_1_id",
  DROP COLUMN IF EXISTS "internal_2_id";

DROP INDEX IF EXISTS "report_templates_teacher_id_idx";
ALTER TABLE "report_templates"
  DROP COLUMN IF EXISTS "teacher_id",
  DROP COLUMN IF EXISTS "type";

ALTER TABLE "scoring_results"
  DROP COLUMN IF EXISTS "committee_scores",
  DROP COLUMN IF EXISTS "failed_count",
  DROP COLUMN IF EXISTS "gvhd_passed",
  DROP COLUMN IF EXISTS "is_eliminated",
  DROP COLUMN IF EXISTS "is_gvhd_failed",
  DROP COLUMN IF EXISTS "total_committee_scores";

DO $$
DECLARE
  role_type text;
BEGIN
  SELECT udt_name INTO role_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'committee_members'
    AND column_name = 'role';

  IF role_type IS NOT NULL AND role_type <> 'CommitteeRole' THEN
    ALTER TABLE "committee_members"
      ALTER COLUMN "role" TYPE "CommitteeRole"
      USING "role"::text::"CommitteeRole";
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "notification_drafts" (
  "id" SERIAL NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "priority" TEXT NOT NULL,
  "recipient_ids" INTEGER[] NOT NULL,
  "sender_id" INTEGER NOT NULL,
  "file_name" TEXT,
  "file_url" TEXT,
  "file_size" INTEGER,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "notification_drafts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "notification_drafts_sender_id_idx"
  ON "notification_drafts"("sender_id");
