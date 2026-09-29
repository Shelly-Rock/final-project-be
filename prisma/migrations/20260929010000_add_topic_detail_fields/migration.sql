-- Add optional topic detail fields used by the management query and forms.
ALTER TABLE "topics"
  ADD COLUMN IF NOT EXISTS "objectives" TEXT,
  ADD COLUMN IF NOT EXISTS "technologies" TEXT;
