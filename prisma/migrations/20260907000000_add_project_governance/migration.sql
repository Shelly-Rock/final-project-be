-- ============================================================
-- Migration: add_project_governance
-- Business-rule config, normalised deadlines, deadline email alerts,
-- topic management (multi-student topics, code generation, audit trail).
-- ============================================================

-- ------------------------------------------------------------
-- 1. Enums
-- ------------------------------------------------------------
CREATE TYPE "DeadlineType" AS ENUM ('TOPIC_CREATION', 'STUDENT_REGISTRATION', 'TEACHER_APPROVAL', 'PERIODIC_REPORT', 'FINAL_SUBMISSION');
CREATE TYPE "AlertEvent" AS ENUM ('DUE_IN_3_DAYS', 'DUE_IN_1_DAY', 'EXPIRED');
CREATE TYPE "AlertRecipientRole" AS ENUM ('TEACHER', 'STUDENT', 'SECRETARY');
CREATE TYPE "AlertStatus" AS ENUM ('PROCESSING', 'SENT', 'FAILED');
CREATE TYPE "ProjectStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'WAITING_SECRETARY', 'ASSIGNED');
CREATE TYPE "TopicAuditAction" AS ENUM ('FORCE_UPDATE', 'BULK_APPROVE', 'BULK_REJECT', 'MANUAL_ASSIGN', 'SUPPLEMENTAL_CREATE', 'CODE_GENERATE', 'CREATE', 'UPDATE', 'REGISTRATION_APPROVE', 'REGISTRATION_REJECT', 'DELETE');

ALTER TYPE "ReportStatus" ADD VALUE IF NOT EXISTS 'MISSING';

-- ------------------------------------------------------------
-- 2. registration_periods: DATE -> TIMESTAMP(3) (giữ nguyên giá trị ngày,
--    mở rộng kiểu để lưu được giờ chính xác). Prisma `DateTime` = TIMESTAMP(3).
-- ------------------------------------------------------------
ALTER TABLE "registration_periods"
  ALTER COLUMN "teacher_deadline" TYPE TIMESTAMP(3) USING ("teacher_deadline"::TIMESTAMP(3)),
  ALTER COLUMN "student_deadline" TYPE TIMESTAMP(3) USING ("student_deadline"::TIMESTAMP(3));

-- ------------------------------------------------------------
-- 3. teacher_quotas: is_override + unique (period_id, teacher_id)
--    Dedup: giữ row có id lớn nhất (bảng này không có timestamp).
-- ------------------------------------------------------------
ALTER TABLE "teacher_quotas" ADD COLUMN "is_override" BOOLEAN NOT NULL DEFAULT false;

DELETE FROM "teacher_quotas" tq
USING (
  SELECT "period_id", "teacher_id", MAX("id") AS keep_id
  FROM "teacher_quotas"
  GROUP BY "period_id", "teacher_id"
  HAVING COUNT(*) > 1
) dup
WHERE tq."period_id" = dup."period_id"
  AND tq."teacher_id" = dup."teacher_id"
  AND tq."id" <> dup.keep_id;

CREATE UNIQUE INDEX "teacher_quotas_period_id_teacher_id_key" ON "teacher_quotas"("period_id", "teacher_id");
CREATE INDEX "teacher_quotas_teacher_id_idx" ON "teacher_quotas"("teacher_id");

-- ------------------------------------------------------------
-- 4. topics: code, supplemental, lock
-- ------------------------------------------------------------
ALTER TABLE "topics"
  ADD COLUMN "code" VARCHAR(80),
  ADD COLUMN "is_supplemental" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "supplemental_reason" TEXT,
  ADD COLUMN "locked_at" TIMESTAMP(3);

CREATE INDEX "topics_period_id_status_idx" ON "topics"("period_id", "status");
CREATE INDEX "topics_teacher_id_idx" ON "topics"("teacher_id");

-- ------------------------------------------------------------
-- 5. projects: cho phép 1 đề tài nhiều sinh viên + trạng thái đăng ký/gán
-- ------------------------------------------------------------
ALTER TABLE "projects"
  ADD COLUMN "status" "ProjectStatus" NOT NULL DEFAULT 'APPROVED',
  ADD COLUMN "deadline_id" INTEGER,
  ADD COLUMN "assigned_by_user_id" INTEGER,
  ADD COLUMN "assign_reason" TEXT,
  ADD COLUMN "decided_by_user_id" INTEGER,
  ADD COLUMN "teacher_decided_at" TIMESTAMP(3),
  ADD COLUMN "moderator_note" TEXT;

-- Bỏ ràng buộc 1-1 cũ giữa Project và topics (giữ nguyên FK ON DELETE SET NULL).
ALTER TABLE "projects" DROP CONSTRAINT "projects_topic_id_key";

CREATE INDEX "projects_topic_id_idx" ON "projects"("topic_id");
CREATE INDEX "projects_status_idx" ON "projects"("status");

-- ------------------------------------------------------------
-- 6. Bảng mới: cấu hình quản trị theo đợt
-- ------------------------------------------------------------
CREATE TABLE "period_governance_configs" (
    "id" SERIAL NOT NULL,
    "period_id" INTEGER NOT NULL,
    "default_topic_limit" INTEGER NOT NULL DEFAULT 3,
    "max_topic_limit" INTEGER NOT NULL DEFAULT 10,
    "max_students_per_topic" INTEGER NOT NULL DEFAULT 3,
    "alerts_enabled" BOOLEAN NOT NULL DEFAULT true,
    "alert_offsets_days" JSONB NOT NULL DEFAULT '[3,1,0]',
    "last_alert_run_at" TIMESTAMP(3),
    "updated_by_user_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "period_governance_configs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "period_governance_configs_period_id_key" UNIQUE ("period_id"),
    CONSTRAINT "period_governance_configs_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "registration_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "period_governance_configs_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "period_deadlines" (
    "id" SERIAL NOT NULL,
    "period_id" INTEGER NOT NULL,
    "type" "DeadlineType" NOT NULL,
    "seq" INTEGER NOT NULL DEFAULT 1,
    "label" VARCHAR(255) NOT NULL,
    "deadline_at" TIMESTAMP(3) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "period_deadlines_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "period_deadlines_period_id_type_seq_key" UNIQUE ("period_id", "type", "seq"),
    CONSTRAINT "period_deadlines_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "period_governance_configs"("period_id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "period_deadlines_deadline_at_idx" ON "period_deadlines"("deadline_at");

CREATE TABLE "deadline_alert_logs" (
    "id" SERIAL NOT NULL,
    "deadline_id" INTEGER NOT NULL,
    "event" "AlertEvent" NOT NULL,
    "recipient_role" "AlertRecipientRole" NOT NULL,
    "recipient_id" INTEGER NOT NULL,
    "recipient_email" VARCHAR(255) NOT NULL,
    "status" "AlertStatus" NOT NULL DEFAULT 'PROCESSING',
    "error" TEXT,
    "attempt_count" INTEGER NOT NULL DEFAULT 1,
    "claimed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deadline_alert_logs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "deadline_alert_logs_deadline_id_event_recipient_role_recip_key" UNIQUE ("deadline_id", "event", "recipient_role", "recipient_id"),
    CONSTRAINT "deadline_alert_logs_deadline_id_fkey" FOREIGN KEY ("deadline_id") REFERENCES "period_deadlines"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "deadline_alert_logs_status_idx" ON "deadline_alert_logs"("status");

CREATE TABLE "topic_audits" (
    "id" SERIAL NOT NULL,
    "topic_id" INTEGER NOT NULL,
    "action" "TopicAuditAction" NOT NULL,
    "before_data" JSONB,
    "after_data" JSONB,
    "reason" TEXT NOT NULL,
    "actor_user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "topic_audits_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "topic_audits_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "topic_audits_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "topic_audits_topic_id_created_at_idx" ON "topic_audits"("topic_id", "created_at");
CREATE INDEX "topic_audits_actor_user_id_idx" ON "topic_audits"("actor_user_id");

CREATE TABLE "topic_code_sequences" (
    "period_id" INTEGER NOT NULL,
    "dept_code" VARCHAR(30) NOT NULL,
    "next_seq" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "topic_code_sequences_pkey" PRIMARY KEY ("period_id", "dept_code"),
    CONSTRAINT "topic_code_sequences_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "registration_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- ------------------------------------------------------------
-- 7. FK mới trên projects/progress_reports sang period_deadlines
-- ------------------------------------------------------------
ALTER TABLE "projects"
  ADD CONSTRAINT "projects_deadline_id_fkey" FOREIGN KEY ("deadline_id") REFERENCES "period_deadlines"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "projects_assigned_by_user_id_fkey" FOREIGN KEY ("assigned_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "projects_decided_by_user_id_fkey" FOREIGN KEY ("decided_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "projects_topic_id_student_id_key" ON "projects"("topic_id", "student_id");

ALTER TABLE "progress_reports"
  ADD COLUMN "deadline_id" INTEGER,
  ADD COLUMN "missing_marked_at" TIMESTAMP(3);

ALTER TABLE "progress_reports"
  ADD CONSTRAINT "progress_reports_deadline_id_fkey" FOREIGN KEY ("deadline_id") REFERENCES "period_deadlines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "progress_reports_student_id_deadline_id_key" ON "progress_reports"("student_id", "deadline_id");
CREATE INDEX "progress_reports_deadline_id_idx" ON "progress_reports"("deadline_id");

-- ------------------------------------------------------------
-- 8. Backfill cấu hình mặc định cho mọi đợt đã tồn tại
-- ------------------------------------------------------------
INSERT INTO "period_governance_configs"
  ("period_id", "default_topic_limit", "max_topic_limit", "max_students_per_topic", "alerts_enabled", "alert_offsets_days", "created_at", "updated_at")
SELECT rp."id", 3, 10, 3, true, '[3,1,0]'::jsonb, NOW(), NOW()
FROM "registration_periods" rp
ON CONFLICT ("period_id") DO NOTHING;

-- Deadline TOPIC_CREATION lấy teacher_deadline + 17:00 cùng ngày.
INSERT INTO "period_deadlines" ("period_id", "type", "seq", "label", "deadline_at", "enabled", "created_at", "updated_at")
SELECT rp."id", 'TOPIC_CREATION'::"DeadlineType", 1, 'Hạn chót tạo / chỉnh sửa đề tài',
       DATE_TRUNC('day', rp."teacher_deadline") + INTERVAL '17 hours', true, NOW(), NOW()
FROM "registration_periods" rp
ON CONFLICT ("period_id", "type", "seq") DO NOTHING;

-- Deadline STUDENT_REGISTRATION lấy student_deadline + 23:59:59 cùng ngày.
INSERT INTO "period_deadlines" ("period_id", "type", "seq", "label", "deadline_at", "enabled", "created_at", "updated_at")
SELECT rp."id", 'STUDENT_REGISTRATION'::"DeadlineType", 1, 'Hạn chót sinh viên đăng ký đề tài',
       DATE_TRUNC('day', rp."student_deadline") + INTERVAL '23 hours' + INTERVAL '59 minutes' + INTERVAL '59 seconds', true, NOW(), NOW()
FROM "registration_periods" rp
ON CONFLICT ("period_id", "type", "seq") DO NOTHING;

-- ------------------------------------------------------------
-- 9. Tính lại registered_students từ số sinh viên thực tế.
--    (Project.status đã được gán DEFAULT 'APPROVED' ở bước 5 nên dữ liệu cũ
--    tự động ở trạng thái đã duyệt — không cần UPDATE riêng.)
-- ------------------------------------------------------------
UPDATE "topics" t
SET "registered_students" = (
  SELECT COUNT(*)::INT
  FROM "projects" p
  WHERE p."topic_id" = t."id"
    AND p."status" IN ('APPROVED', 'ASSIGNED')
);

-- ------------------------------------------------------------
-- 10. Backfill mã đề tài DT<year>_<DEPT>_<seq>, đồng bộ sequence.
--     Làm TRƯỚC khi tạo unique index trên topics.code.
-- ------------------------------------------------------------
WITH dept AS (
  SELECT
    t."id" AS topic_id,
    t."period_id",
    COALESCE(NULLIF(UPPER(REGEXP_REPLACE(COALESCE(tt."department_id", ''), '[^A-Za-z0-9]', '', 'g')), ''), 'GEN') AS dept_code
  FROM "topics" t
  LEFT JOIN "teachers" tt ON tt."id" = t."teacher_id"
),
numbered AS (
  SELECT
    dept.topic_id,
    dept.period_id,
    dept.dept_code,
    REGEXP_REPLACE(rp."school_year", '^.*([0-9]{4}).*$', '\1') AS year,
    ROW_NUMBER() OVER (PARTITION BY dept.period_id, dept.dept_code ORDER BY dept.topic_id) AS seq
  FROM dept
  JOIN "registration_periods" rp ON rp."id" = dept.period_id
  WHERE dept.topic_id IN (SELECT "id" FROM "topics" WHERE "code" IS NULL)
)
UPDATE "topics" t
SET "code" = 'DT' || numbered.year || '_' || numbered.dept_code || '_' || LPAD(numbered.seq::TEXT, 3, '0')
FROM numbered
WHERE numbered.topic_id = t."id";

INSERT INTO "topic_code_sequences" ("period_id", "dept_code", "next_seq")
SELECT
  t."period_id",
  COALESCE(NULLIF(UPPER(REGEXP_REPLACE(COALESCE(tt."department_id", ''), '[^A-Za-z0-9]', '', 'g')), ''), 'GEN') AS dept_code,
  MAX(CAST(RIGHT(t."code", 3) AS INT)) + 1
FROM "topics" t
LEFT JOIN "teachers" tt ON tt."id" = t."teacher_id"
WHERE t."code" IS NOT NULL
GROUP BY
  t."period_id",
  COALESCE(NULLIF(UPPER(REGEXP_REPLACE(COALESCE(tt."department_id", ''), '[^A-Za-z0-9]', '', 'g')), ''), 'GEN')
ON CONFLICT ("period_id", "dept_code") DO NOTHING;

CREATE UNIQUE INDEX "topics_code_key" ON "topics"("code");
