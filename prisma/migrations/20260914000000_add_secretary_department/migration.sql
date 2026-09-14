-- AddForeignKey for Secretary to Department (1-1 relationship)
ALTER TABLE "secretaries" ADD COLUMN "department_id" VARCHAR(50);
ALTER TABLE "secretaries" ADD CONSTRAINT "secretaries_department_id_key" UNIQUE ("department_id");
ALTER TABLE "secretaries" ADD CONSTRAINT "secretaries_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
