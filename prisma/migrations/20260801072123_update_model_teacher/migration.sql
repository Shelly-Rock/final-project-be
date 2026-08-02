/*
  Warnings:

  - The `academic_title` column on the `teachers` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "AcademicTitle" AS ENUM ('MASTER', 'DOCTOR', 'ASSOC_PROF', 'PROF');

-- AlterTable
ALTER TABLE "teachers" DROP COLUMN "academic_title",
ADD COLUMN     "academic_title" "AcademicTitle";
