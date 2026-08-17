-- CreateEnum
CREATE TYPE "RegistrationPeriodStatus" AS ENUM ('UPCOMING', 'OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "TeacherQuotaStatus" AS ENUM ('SUFFICIENT', 'INSUFFICIENT');

-- CreateEnum
CREATE TYPE "TopicStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ExceptionRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "registration_periods" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "semester" VARCHAR(10) NOT NULL,
    "school_year" VARCHAR(20) NOT NULL,
    "start_date" DATE NOT NULL,
    "teacher_deadline" DATE NOT NULL,
    "student_deadline" DATE NOT NULL,
    "default_quota" INTEGER NOT NULL,
    "status" "RegistrationPeriodStatus" NOT NULL DEFAULT 'UPCOMING',
    "description" TEXT,
    "department_student_limits" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "registration_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teacher_quotas" (
    "id" SERIAL NOT NULL,
    "period_id" INTEGER NOT NULL,
    "teacher_id" INTEGER NOT NULL,
    "assigned_quota" INTEGER NOT NULL,
    "submitted_topics" INTEGER NOT NULL DEFAULT 0,
    "max_students" INTEGER NOT NULL,
    "status" "TeacherQuotaStatus" NOT NULL DEFAULT 'INSUFFICIENT',
    "last_notified_at" TIMESTAMP(3),

    CONSTRAINT "teacher_quotas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "topics" (
    "id" SERIAL NOT NULL,
    "period_id" INTEGER NOT NULL,
    "teacher_id" INTEGER NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "max_students" INTEGER NOT NULL,
    "registered_students" INTEGER NOT NULL DEFAULT 0,
    "status" "TopicStatus" NOT NULL DEFAULT 'PENDING',
    "moderator_note" TEXT,
    "rejection_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exception_requests" (
    "id" SERIAL NOT NULL,
    "topic_id" INTEGER NOT NULL,
    "teacher_id" INTEGER NOT NULL,
    "max_students" INTEGER NOT NULL,
    "students" JSONB NOT NULL,
    "status" "ExceptionRequestStatus" NOT NULL DEFAULT 'PENDING',
    "rejection_reason" TEXT,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exception_requests_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "teacher_quotas" ADD CONSTRAINT "teacher_quotas_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "registration_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_quotas" ADD CONSTRAINT "teacher_quotas_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topics" ADD CONSTRAINT "topics_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "registration_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topics" ADD CONSTRAINT "topics_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exception_requests" ADD CONSTRAINT "exception_requests_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exception_requests" ADD CONSTRAINT "exception_requests_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
