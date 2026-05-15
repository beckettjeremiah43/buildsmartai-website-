-- Run this in the Supabase SQL editor to add financial columns to jobs
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS contract_value numeric(12,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cost           numeric(12,2) DEFAULT NULL;
