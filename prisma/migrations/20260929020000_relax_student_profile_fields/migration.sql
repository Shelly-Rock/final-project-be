-- Minimal roster imports may not contain profile-only demographic fields.
ALTER TABLE "students"
  ALTER COLUMN "date_of_birth" DROP NOT NULL,
  ALTER COLUMN "gender" DROP NOT NULL;
