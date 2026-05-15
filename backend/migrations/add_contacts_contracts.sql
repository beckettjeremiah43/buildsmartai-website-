-- Run in Supabase SQL editor

CREATE TABLE IF NOT EXISTS contacts (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id  uuid REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  name       text NOT NULL,
  company    text,
  email      text,
  phone      text,
  type       text DEFAULT 'client'
             CHECK (type IN ('client','subcontractor','vendor','supplier','other')),
  notes      text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contracts (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id  uuid REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  title      text NOT NULL,
  job_id     uuid REFERENCES jobs(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  value      numeric(12,2),
  status     text DEFAULT 'draft'
             CHECK (status IN ('draft','sent','signed','active','completed','cancelled')),
  start_date date,
  end_date   date,
  signed_at  date,
  notes      text,
  created_at timestamptz DEFAULT now()
);
