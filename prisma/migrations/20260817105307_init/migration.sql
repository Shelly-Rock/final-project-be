-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SubmissionType" AS ENUM ('WORD', 'PDF', 'POWERPOINT');

-- CreateEnum
CREATE TYPE "CommitteeRole" AS ENUM ('CHAIRMAN', 'SECRETARY', 'INTERNAL_REVIEWER', 'EXTERNAL_REVIEWER');

-- CreateEnum
CREATE TYPE "DefenseSessionStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED', 'RESCHEDULED');

-- CreateEnum
CREATE TYPE "ScoringStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'SUBMITTED', 'FAILED', 'PASSED');

-- CreateEnum
CREATE TYPE "ScoringType" AS ENUM ('GVHD', 'COMMITTEE');

-- CreateTable
CREATE TABLE "final_submissions" (
    "id" SERIAL NOT NULL,
    "student_id" INTEGER NOT NULL,
    "project_id" INTEGER NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "file_type" "SubmissionType" NOT NULL,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_by" INTEGER,
    "reviewed_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "final_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "defense_committees" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "chairman_id" INTEGER,
    "secretary_id" INTEGER,
    "internal_1_id" INTEGER,
    "internal_2_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "defense_committees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "committee_external_reviewers" (
    "id" SERIAL NOT NULL,
    "committee_id" INTEGER NOT NULL,
    "teacher_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "committee_external_reviewers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "defense_sessions" (
    "id" SERIAL NOT NULL,
    "committee_id" INTEGER NOT NULL,
    "defense_date" TIMESTAMP(3) NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT,
    "room" TEXT NOT NULL,
    "duration_minutes" INTEGER NOT NULL DEFAULT 15,
    "status" "DefenseSessionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "defense_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "defense_session_projects" (
    "id" SERIAL NOT NULL,
    "session_id" INTEGER NOT NULL,
    "project_id" INTEGER NOT NULL,
    "order_index" INTEGER NOT NULL,
    "scheduled_time" TEXT NOT NULL,
    "score" DOUBLE PRECISION,
    "defense_notes" TEXT,
    "defended_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "defense_session_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "defense_scores" (
    "id" SERIAL NOT NULL,
    "session_project_id" INTEGER NOT NULL,
    "teacher_id" INTEGER NOT NULL,
    "role" "CommitteeRole" NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "defense_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "independent_scores" (
    "id" SERIAL NOT NULL,
    "project_id" INTEGER NOT NULL,
    "student_id" INTEGER NOT NULL,
    "teacher_id" INTEGER NOT NULL,
    "scoring_type" "ScoringType" NOT NULL,
    "role" "CommitteeRole",
    "score" DOUBLE PRECISION,
    "max_score" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "criteria_scores" JSONB,
    "status" "ScoringStatus" NOT NULL DEFAULT 'PENDING',
    "deadline" TIMESTAMP(3),
    "submitted_at" TIMESTAMP(3),
    "notes" TEXT,
    "strengths" TEXT,
    "weaknesses" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "independent_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scoring_results" (
    "id" SERIAL NOT NULL,
    "project_id" INTEGER NOT NULL,
    "student_id" INTEGER NOT NULL,
    "gvhd_score" DOUBLE PRECISION,
    "gvhd_passed" BOOLEAN NOT NULL DEFAULT false,
    "committee_scores" JSONB,
    "total_committee_scores" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "is_eliminated" BOOLEAN NOT NULL DEFAULT false,
    "is_gvhd_failed" BOOLEAN NOT NULL DEFAULT false,
    "final_status" TEXT,
    "score_sheet_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scoring_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "final_submissions_student_id_key" ON "final_submissions"("student_id");

-- CreateIndex
CREATE UNIQUE INDEX "final_submissions_project_id_key" ON "final_submissions"("project_id");

-- CreateIndex
CREATE INDEX "final_submissions_project_id_idx" ON "final_submissions"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "committee_external_reviewers_committee_id_teacher_id_key" ON "committee_external_reviewers"("committee_id", "teacher_id");

-- CreateIndex
CREATE INDEX "defense_sessions_committee_id_idx" ON "defense_sessions"("committee_id");

-- CreateIndex
CREATE INDEX "defense_sessions_defense_date_idx" ON "defense_sessions"("defense_date");

-- CreateIndex
CREATE INDEX "defense_session_projects_session_id_idx" ON "defense_session_projects"("session_id");

-- CreateIndex
CREATE UNIQUE INDEX "defense_session_projects_session_id_project_id_key" ON "defense_session_projects"("session_id", "project_id");

-- CreateIndex
CREATE UNIQUE INDEX "defense_scores_session_project_id_teacher_id_key" ON "defense_scores"("session_project_id", "teacher_id");

-- CreateIndex
CREATE INDEX "independent_scores_project_id_idx" ON "independent_scores"("project_id");

-- CreateIndex
CREATE INDEX "independent_scores_teacher_id_idx" ON "independent_scores"("teacher_id");

-- CreateIndex
CREATE INDEX "independent_scores_student_id_idx" ON "independent_scores"("student_id");

-- CreateIndex
CREATE UNIQUE INDEX "independent_scores_project_id_teacher_id_scoring_type_key" ON "independent_scores"("project_id", "teacher_id", "scoring_type");

-- CreateIndex
CREATE UNIQUE INDEX "scoring_results_project_id_key" ON "scoring_results"("project_id");

-- CreateIndex
CREATE INDEX "scoring_results_student_id_idx" ON "scoring_results"("student_id");

-- AddForeignKey
ALTER TABLE "final_submissions" ADD CONSTRAINT "final_submissions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "final_submissions" ADD CONSTRAINT "final_submissions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "defense_committees" ADD CONSTRAINT "defense_committees_chairman_id_fkey" FOREIGN KEY ("chairman_id") REFERENCES "teachers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "defense_committees" ADD CONSTRAINT "defense_committees_secretary_id_fkey" FOREIGN KEY ("secretary_id") REFERENCES "teachers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "defense_committees" ADD CONSTRAINT "defense_committees_internal_1_id_fkey" FOREIGN KEY ("internal_1_id") REFERENCES "teachers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "defense_committees" ADD CONSTRAINT "defense_committees_internal_2_id_fkey" FOREIGN KEY ("internal_2_id") REFERENCES "teachers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "committee_external_reviewers" ADD CONSTRAINT "committee_external_reviewers_committee_id_fkey" FOREIGN KEY ("committee_id") REFERENCES "defense_committees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "committee_external_reviewers" ADD CONSTRAINT "committee_external_reviewers_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "defense_sessions" ADD CONSTRAINT "defense_sessions_committee_id_fkey" FOREIGN KEY ("committee_id") REFERENCES "defense_committees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "defense_session_projects" ADD CONSTRAINT "defense_session_projects_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "defense_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "defense_session_projects" ADD CONSTRAINT "defense_session_projects_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "defense_scores" ADD CONSTRAINT "defense_scores_session_project_id_fkey" FOREIGN KEY ("session_project_id") REFERENCES "defense_session_projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "defense_scores" ADD CONSTRAINT "defense_scores_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "independent_scores" ADD CONSTRAINT "independent_scores_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "independent_scores" ADD CONSTRAINT "independent_scores_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "independent_scores" ADD CONSTRAINT "independent_scores_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scoring_results" ADD CONSTRAINT "scoring_results_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
