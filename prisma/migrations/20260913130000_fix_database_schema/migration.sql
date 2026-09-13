-- Migration: Fix database schema inconsistencies
-- Purpose: Align PostgreSQL schema with current Prisma schema
-- Issues: Missing committee_members table, missing scoring_results columns

-- ============================================================
-- 1. Create committee_members table if it doesn't exist
-- ============================================================
CREATE TABLE IF NOT EXISTS "committee_members" (
    "id" SERIAL NOT NULL,
    "committee_id" INTEGER NOT NULL,
    "teacher_id" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "committee_members_pkey" PRIMARY KEY ("id")
);

-- Add foreign keys if they don't exist (PostgreSQL 13+)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'committee_members_committee_id_fkey'
    ) THEN
        ALTER TABLE "committee_members"
        ADD CONSTRAINT "committee_members_committee_id_fkey"
        FOREIGN KEY ("committee_id") REFERENCES "defense_committees"("id") ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'committee_members_teacher_id_fkey'
    ) THEN
        ALTER TABLE "committee_members"
        ADD CONSTRAINT "committee_members_teacher_id_fkey"
        FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id");
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'committee_members_committee_id_teacher_id_unique'
    ) THEN
        ALTER TABLE "committee_members"
        ADD CONSTRAINT "committee_members_committee_id_teacher_id_unique"
        UNIQUE ("committee_id", "teacher_id");
    END IF;
END $$;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS "committee_members_committee_id_idx" ON "committee_members"("committee_id");
CREATE INDEX IF NOT EXISTS "committee_members_teacher_id_idx" ON "committee_members"("teacher_id");

-- ============================================================
-- 2. Add missing period_id to defense_committees
-- ============================================================
DO $$
BEGIN
    -- Add period_id if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'defense_committees' AND column_name = 'period_id'
    ) THEN
        ALTER TABLE "defense_committees" ADD COLUMN "period_id" INTEGER;
        ALTER TABLE "defense_committees"
        ADD CONSTRAINT "defense_committees_period_id_fkey"
        FOREIGN KEY ("period_id") REFERENCES "registration_periods"("id") ON DELETE SET NULL;
    END IF;
END $$;

-- ============================================================
-- 3. Add missing columns to scoring_results
-- ============================================================
DO $$
BEGIN
    -- Add review_score if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'scoring_results' AND column_name = 'review_score'
    ) THEN
        ALTER TABLE "scoring_results" ADD COLUMN "review_score" DOUBLE PRECISION;
    END IF;

    -- Add defense_score if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'scoring_results' AND column_name = 'defense_score'
    ) THEN
        ALTER TABLE "scoring_results" ADD COLUMN "defense_score" DOUBLE PRECISION;
    END IF;

    -- Add final_score if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'scoring_results' AND column_name = 'final_score'
    ) THEN
        ALTER TABLE "scoring_results" ADD COLUMN "final_score" DOUBLE PRECISION;
    END IF;

    -- Add is_gvhd_passed if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'scoring_results' AND column_name = 'is_gvhd_passed'
    ) THEN
        ALTER TABLE "scoring_results" ADD COLUMN "is_gvhd_passed" BOOLEAN NOT NULL DEFAULT false;
    END IF;

    -- Add is_final_passed if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'scoring_results' AND column_name = 'is_final_passed'
    ) THEN
        ALTER TABLE "scoring_results" ADD COLUMN "is_final_passed" BOOLEAN NOT NULL DEFAULT false;
    END IF;
END $$;
