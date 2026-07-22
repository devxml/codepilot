-- Safe migration for databases shared by the Express and AI services.
-- Do not use `prisma db push` against this database: it may attempt to remove
-- the AI service's projects, files, chunks, and conversations tables.
ALTER TABLE repositories
  ADD COLUMN IF NOT EXISTS initial_report TEXT;

ALTER TABLE repositories
  ADD COLUMN IF NOT EXISTS report_generated_at TIMESTAMP(3);
