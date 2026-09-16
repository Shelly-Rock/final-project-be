-- AddColumn student_id to final_submissions if it doesn't exist
ALTER TABLE "final_submissions" ADD COLUMN IF NOT EXISTS "student_id" INTEGER UNIQUE;

-- Add foreign key constraint if not exists
ALTER TABLE "final_submissions" ADD CONSTRAINT "final_submissions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
