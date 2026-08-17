-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'REVISION_REQUESTED');

-- CreateEnum
CREATE TYPE "ProgressStatus" AS ENUM ('ON_TRACK', 'EXTENDED', 'TOPIC_CHANGED', 'BANNED');

-- CreateEnum
CREATE TYPE "TemplateType" AS ENUM ('MONTHLY_REPORT', 'MIDTERM_REPORT', 'FINAL_REPORT', 'PROPOSAL', 'PRESENTATION');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('STATUS_CHANGED', 'REPORT_SUBMITTED', 'REPORT_APPROVED', 'REPORT_REJECTED', 'BAN_APPLIED', 'BAN_WARNING');

-- CreateTable
CREATE TABLE "report_templates" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "TemplateType" NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "teacher_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "report_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "progress_reports" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "file_url" TEXT,
    "file_name" TEXT,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "feedback" TEXT,
    "score" INTEGER,
    "student_id" INTEGER NOT NULL,
    "teacher_id" INTEGER NOT NULL,
    "reviewed_by" INTEGER,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "progress_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_progress" (
    "id" SERIAL NOT NULL,
    "student_id" INTEGER NOT NULL,
    "status" "ProgressStatus" NOT NULL DEFAULT 'ON_TRACK',
    "is_banned" BOOLEAN NOT NULL DEFAULT false,
    "ban_reason" TEXT,
    "banned_at" TIMESTAMP(3),
    "total_reports_required" INTEGER NOT NULL DEFAULT 6,
    "total_reports_submitted" INTEGER NOT NULL DEFAULT 0,
    "next_deadline" TIMESTAMP(3),
    "last_report_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "student_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "progress_notifications" (
    "id" SERIAL NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "sender_id" INTEGER,
    "recipient_id" INTEGER NOT NULL,
    "related_student_id" INTEGER,
    "related_report_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "progress_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "report_templates_teacher_id_idx" ON "report_templates"("teacher_id");

-- CreateIndex
CREATE INDEX "progress_reports_student_id_idx" ON "progress_reports"("student_id");

-- CreateIndex
CREATE INDEX "progress_reports_teacher_id_idx" ON "progress_reports"("teacher_id");

-- CreateIndex
CREATE UNIQUE INDEX "student_progress_student_id_key" ON "student_progress"("student_id");

-- CreateIndex
CREATE INDEX "student_progress_student_id_idx" ON "student_progress"("student_id");

-- CreateIndex
CREATE INDEX "progress_notifications_recipient_id_idx" ON "progress_notifications"("recipient_id");

-- CreateIndex
CREATE INDEX "progress_notifications_sender_id_idx" ON "progress_notifications"("sender_id");
