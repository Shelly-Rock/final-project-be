/*
  Warnings:

  - You are about to drop the column `remember_token` on the `users` table. All the data in the column will be lost.
  - Added the required column `middle_name` to the `students` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "students" ADD COLUMN     "middle_name" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "remember_token",
ADD COLUMN     "must_change_password" BOOLEAN NOT NULL DEFAULT true;
