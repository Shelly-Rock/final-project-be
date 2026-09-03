-- Migration: Remove teacher_id from Student, remove email from Student
-- Created: 2024-08-19
-- Issues: 1.1 & 1.2 - Xóa teacher_id, bỏ email (dùng user.email)

-- ============================================
-- 1. Xóa teacher_id từ Student (1.2)
-- ============================================
ALTER TABLE "students" DROP CONSTRAINT IF EXISTS "students_teacher_id_fkey";
ALTER TABLE "students" DROP COLUMN IF EXISTS "teacher_id";

-- ============================================
-- 2. Bỏ email từ Student, dùng user.email (1.1)
-- ============================================
-- Trước tiên, cập nhật email từ user vào student (nếu cần backup)
-- UPDATE "students" SET "email" = (SELECT "email" FROM "users" WHERE "users"."id" = "students"."user_id");

-- Xóa cột email từ students (sau khi đã backup)
ALTER TABLE "students" DROP COLUMN IF EXISTS "email";
