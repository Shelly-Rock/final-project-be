-- Giai đoạn 7: hạn chỉnh sửa hồ sơ + xếp hạng
ALTER TABLE "scoring_results"
  ADD COLUMN "revision_deadline" TIMESTAMP(3),
  ADD COLUMN "rank" INTEGER,
  ADD COLUMN "rank_override" INTEGER,
  ADD COLUMN "rank_note" TEXT,
  ADD COLUMN "ranked_at" TIMESTAMP(3);

CREATE INDEX "scoring_results_rank_idx" ON "scoring_results"("rank");

CREATE TABLE "thesis_revisions" (
    "id" SERIAL NOT NULL,
    "project_id" INTEGER NOT NULL,
    "student_id" INTEGER NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "note" TEXT,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "thesis_revisions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "thesis_revisions_project_id_idx" ON "thesis_revisions"("project_id");
CREATE INDEX "thesis_revisions_student_id_idx" ON "thesis_revisions"("student_id");

ALTER TABLE "thesis_revisions" ADD CONSTRAINT "thesis_revisions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "thesis_revisions" ADD CONSTRAINT "thesis_revisions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
