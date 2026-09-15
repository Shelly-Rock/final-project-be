/*
  Warnings:

  - You are about to drop the column `chairman_id` on the `defense_committees` table. All the data in the column will be lost.
  - You are about to drop the column `internal_1_id` on the `defense_committees` table. All the data in the column will be lost.
  - You are about to drop the column `internal_2_id` on the `defense_committees` table. All the data in the column will be lost.
  - You are about to drop the column `secretary_id` on the `defense_committees` table. All the data in the column will be lost.
  - You are about to drop the column `committee_scores` on the `scoring_results` table. All the data in the column will be lost.
  - You are about to drop the column `failed_count` on the `scoring_results` table. All the data in the column will be lost.
  - You are about to drop the column `gvhd_passed` on the `scoring_results` table. All the data in the column will be lost.
  - You are about to drop the column `is_eliminated` on the `scoring_results` table. All the data in the column will be lost.
  - You are about to drop the column `is_gvhd_failed` on the `scoring_results` table. All the data in the column will be lost.
  - You are about to drop the column `total_committee_scores` on the `scoring_results` table. All the data in the column will be lost.
  - You are about to drop the column `teacher_id` on the `students` table. All the data in the column will be lost.
  - Changed the type of `role` on the `committee_members` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropForeignKey
ALTER TABLE "committee_members" DROP CONSTRAINT "committee_members_committee_id_fkey";

-- DropForeignKey
ALTER TABLE "committee_members" DROP CONSTRAINT "committee_members_teacher_id_fkey";

-- DropForeignKey
ALTER TABLE "defense_committees" DROP CONSTRAINT "defense_committees_chairman_id_fkey";

-- DropForeignKey
ALTER TABLE "defense_committees" DROP CONSTRAINT "defense_committees_internal_1_id_fkey";

-- DropForeignKey
ALTER TABLE "defense_committees" DROP CONSTRAINT "defense_committees_internal_2_id_fkey";

-- DropForeignKey
ALTER TABLE "defense_committees" DROP CONSTRAINT "defense_committees_period_id_fkey";

-- DropForeignKey
ALTER TABLE "defense_committees" DROP CONSTRAINT "defense_committees_secretary_id_fkey";

-- DropForeignKey
ALTER TABLE "projects" DROP CONSTRAINT "projects_topic_id_fkey";

-- DropForeignKey
ALTER TABLE "scoring_results" DROP CONSTRAINT "scoring_results_student_id_fkey";

-- DropForeignKey
ALTER TABLE "students" DROP CONSTRAINT "students_teacher_id_fkey";

-- AlterTable
ALTER TABLE "committee_members" DROP COLUMN "role",
ADD COLUMN     "role" "CommitteeRole" NOT NULL;

-- AlterTable
ALTER TABLE "defense_committees" DROP COLUMN "chairman_id",
DROP COLUMN "internal_1_id",
DROP COLUMN "internal_2_id",
DROP COLUMN "secretary_id";

-- AlterTable
ALTER TABLE "progress_reports" ADD COLUMN     "period_id" INTEGER;

-- AlterTable
ALTER TABLE "scoring_results" DROP COLUMN "committee_scores",
DROP COLUMN "failed_count",
DROP COLUMN "gvhd_passed",
DROP COLUMN "is_eliminated",
DROP COLUMN "is_gvhd_failed",
DROP COLUMN "total_committee_scores";

-- AlterTable
ALTER TABLE "students" DROP COLUMN "teacher_id";

-- CreateIndex
CREATE INDEX "progress_reports_period_id_idx" ON "progress_reports"("period_id");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "committee_members" ADD CONSTRAINT "committee_members_committee_id_fkey" FOREIGN KEY ("committee_id") REFERENCES "defense_committees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "committee_members" ADD CONSTRAINT "committee_members_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_reports" ADD CONSTRAINT "progress_reports_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "registration_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scoring_results" ADD CONSTRAINT "scoring_results_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "committee_members_committee_id_teacher_id_unique" RENAME TO "committee_members_committee_id_teacher_id_key";

-- RenameIndex
ALTER INDEX "deadline_alert_logs_deadline_id_event_recipient_role_recip_key" RENAME TO "deadline_alert_logs_deadline_id_event_recipient_role_recipi_key";
