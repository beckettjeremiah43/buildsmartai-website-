-- Run in Supabase SQL editor

-- 1. Create the storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('contract-docs', 'contract-docs', false)
ON CONFLICT (id) DO NOTHING;

-- 2. Storage RLS: authenticated users can manage files
CREATE POLICY "Authenticated upload contract docs"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'contract-docs' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated read contract docs"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'contract-docs' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated delete contract docs"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'contract-docs' AND auth.role() = 'authenticated');

-- 3. Document metadata table
CREATE TABLE IF NOT EXISTS contract_documents (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id uuid REFERENCES contracts(id) ON DELETE CASCADE NOT NULL,
  client_id   uuid REFERENCES clients(id)   ON DELETE CASCADE NOT NULL,
  name        text NOT NULL,
  path        text NOT NULL,
  size        bigint,
  mime_type   text,
  created_at  timestamptz DEFAULT now()
);
