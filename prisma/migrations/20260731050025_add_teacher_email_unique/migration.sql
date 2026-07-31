/*
  Warnings:

  - You are about to drop the column `major` on the `teachers` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[email]` on the table `teachers` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `department` to the `teachers` table without a default value. This is not possible if the table is not empty.
  - Added the required column `email` to the `teachers` table without a default value. This is not possible if the table is not empty.
  - Added the required column `first_name` to the `teachers` table without a default value. This is not possible if the table is not empty.
  - Added the required column `full_name` to the `teachers` table without a default value. This is not possible if the table is not empty.
  - Added the required column `last_name` to the `teachers` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "TeacherStatus" AS ENUM ('active', 'inactive');

-- AlterTable
ALTER TABLE "teachers" DROP COLUMN "major",
ADD COLUMN     "academic_title" TEXT,
ADD COLUMN     "address" TEXT,
ADD COLUMN     "date_of_birth" DATE,
ADD COLUMN     "department" TEXT NOT NULL,
ADD COLUMN     "email" TEXT NOT NULL,
ADD COLUMN     "first_name" TEXT NOT NULL,
ADD COLUMN     "full_name" TEXT NOT NULL,
ADD COLUMN     "gender" "Gender",
ADD COLUMN     "last_name" TEXT NOT NULL,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "position" TEXT,
ADD COLUMN     "status" "TeacherStatus" NOT NULL DEFAULT 'active';

-- CreateIndex
CREATE UNIQUE INDEX "teachers_email_key" ON "teachers"("email");
