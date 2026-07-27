-- CreateTable
CREATE TABLE "projects" (
    "id" SERIAL NOT NULL,
    "project_id" TEXT NOT NULL,
    "project_name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "student_id" INTEGER NOT NULL,
    "teacher_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "projects_project_id_key" ON "projects"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "projects_student_id_key" ON "projects"("student_id");

-- CreateIndex
CREATE INDEX "projects_teacher_id_idx" ON "projects"("teacher_id");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
