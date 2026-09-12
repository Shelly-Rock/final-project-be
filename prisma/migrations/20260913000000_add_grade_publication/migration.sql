-- ============================================================
-- Migration: add_grade_publication
-- Giai đoạn 6: điểm thưởng + công bố bảng điểm cho sinh viên.
-- ============================================================

ALTER TABLE "scoring_results"
  ADD COLUMN "bonus_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "bonus_note" TEXT,
  ADD COLUMN "bonus_by_teacher_id" INTEGER,
  ADD COLUMN "is_published" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "published_at" TIMESTAMP(3);
