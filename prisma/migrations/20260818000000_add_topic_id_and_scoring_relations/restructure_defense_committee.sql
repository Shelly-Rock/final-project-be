-- Migration: Restructure DefenseCommittee with CommitteeMember
-- Created: 2024-08-19
-- Issue: 2.1 - Linh hoạt hóa cấu trúc hội đồng

-- ============================================
-- 1. Tạo bảng committee_members
-- ============================================
CREATE TABLE IF NOT EXISTS "committee_members" (
    "id" SERIAL PRIMARY KEY,
    "committee_id" INTEGER NOT NULL,
    "teacher_id" INTEGER NOT NULL,
    "role" TEXT NOT NULL, -- CHAIRMAN, SECRETARY, INTERNAL_REVIEWER, EXTERNAL_REVIEWER
    "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "committee_members_committee_id_fkey" FOREIGN KEY ("committee_id") REFERENCES "defense_committees"("id") ON DELETE CASCADE,
    CONSTRAINT "committee_members_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id"),
    CONSTRAINT "committee_members_committee_id_teacher_id_unique" UNIQUE ("committee_id", "teacher_id")
);

CREATE INDEX IF NOT EXISTS "committee_members_committee_id_idx" ON "committee_members"("committee_id");
CREATE INDEX IF NOT EXISTS "committee_members_teacher_id_idx" ON "committee_members"("teacher_id");

-- ============================================
-- 2. Migrate dữ liệu từ 4 cột cũ vào bảng mới
-- ============================================
-- Migrate Chairman
INSERT INTO "committee_members" ("committee_id", "teacher_id", "role")
SELECT "id", "chairman_id", 'CHAIRMAN'
FROM "defense_committees"
WHERE "chairman_id" IS NOT NULL;

-- Migrate Secretary
INSERT INTO "committee_members" ("committee_id", "teacher_id", "role")
SELECT "id", "secretary_id", 'SECRETARY'
FROM "defense_committees"
WHERE "secretary_id" IS NOT NULL;

-- Migrate Internal 1
INSERT INTO "committee_members" ("committee_id", "teacher_id", "role")
SELECT "id", "internal_1_id", 'INTERNAL_REVIEWER'
FROM "defense_committees"
WHERE "internal_1_id" IS NOT NULL;

-- Migrate Internal 2
INSERT INTO "committee_members" ("committee_id", "teacher_id", "role")
SELECT "id", "internal_2_id", 'INTERNAL_REVIEWER'
FROM "defense_committees"
WHERE "internal_2_id" IS NOT NULL;

-- ============================================
-- 3. Thêm cột period_id vào defense_committees
-- ============================================
ALTER TABLE "defense_committees" ADD COLUMN IF NOT EXISTS "period_id" INTEGER;
ALTER TABLE "defense_committees" ADD CONSTRAINT "defense_committees_period_id_fkey" 
    FOREIGN KEY ("period_id") REFERENCES "registration_periods"("id") ON DELETE SET NULL;

-- ============================================
-- 4. Xóa 4 cột cũ từ defense_committees
-- ============================================
ALTER TABLE "defense_committees" DROP COLUMN IF EXISTS "chairman_id";
ALTER TABLE "defense_committees" DROP COLUMN IF EXISTS "secretary_id";
ALTER TABLE "defense_committees" DROP COLUMN IF EXISTS "internal_1_id";
ALTER TABLE "defense_committees" DROP COLUMN IF EXISTS "internal_2_id";
