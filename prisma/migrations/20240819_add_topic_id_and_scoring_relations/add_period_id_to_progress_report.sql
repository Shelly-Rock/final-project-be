-- Migration: Add period_id to ProgressReport
-- Created: 2024-08-19
-- Issue: 2.3 - Gắn ProgressReport với RegistrationPeriod

ALTER TABLE "progress_reports" ADD COLUMN IF NOT EXISTS "period_id" INTEGER;
ALTER TABLE "progress_reports" ADD CONSTRAINT "progress_reports_period_id_fkey" 
    FOREIGN KEY ("period_id") REFERENCES "registration_periods"("id") ON DELETE SET NULL;

-- Tạo index cho period_id
CREATE INDEX IF NOT EXISTS "progress_reports_period_id_idx" ON "progress_reports"("period_id");
