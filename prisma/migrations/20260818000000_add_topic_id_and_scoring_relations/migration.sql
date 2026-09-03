-- Migration: Add topic_id to Project and scoring_relations
-- Created: 2024-08-19

-- 1. Add topic_id column to projects table (nullable, unique for 1-1 relation)
ALTER TABLE "projects" ADD COLUMN "topic_id" INTEGER;

-- 2. Add foreign key constraint for topic_id
ALTER TABLE "projects" ADD CONSTRAINT "projects_topic_id_fkey" 
    FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE SET NULL;

-- 3. Add unique constraint for topic_id (1-1 relation)
ALTER TABLE "projects" ADD CONSTRAINT "projects_topic_id_key" UNIQUE ("topic_id");

-- 4. Add foreign key constraint for student_id in scoring_results
ALTER TABLE "scoring_results" ADD CONSTRAINT "scoring_results_student_id_fkey" 
    FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT;
