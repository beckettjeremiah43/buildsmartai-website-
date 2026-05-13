-- ScheduleAI Database Schema
-- Run this in your Supabase SQL editor

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- CLIENTS (contractor companies)
-- ============================================================
CREATE TABLE clients (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name        TEXT NOT NULL,
  owner_name          TEXT NOT NULL,
  email               TEXT UNIQUE NOT NULL,
  phone               TEXT,
  stripe_customer_id  TEXT,
  subscription_tier   TEXT DEFAULT 'starter' CHECK (subscription_tier IN ('starter', 'pro', 'growth')),
  subscription_status TEXT DEFAULT 'trial'   CHECK (subscription_status IN ('trial', 'active', 'past_due', 'cancelled')),
  ai_system_prompt    TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- JOBS
-- ============================================================
CREATE TABLE jobs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id  UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  address    TEXT,
  status     TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused')),
  start_date DATE,
  end_date   DATE,
  phases     JSONB DEFAULT '[]',
  notes      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_jobs_client_id ON jobs(client_id);
CREATE INDEX idx_jobs_status    ON jobs(status);
CREATE INDEX idx_jobs_dates     ON jobs(start_date, end_date);

-- ============================================================
-- CREW MEMBERS
-- ============================================================
CREATE TABLE crew (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id  UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  phone      TEXT,
  skills     TEXT[] DEFAULT '{}',
  status     TEXT DEFAULT 'available' CHECK (status IN ('available', 'on_site', 'sick', 'off')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_crew_client_id ON crew(client_id);
CREATE INDEX idx_crew_status    ON crew(status);

-- ============================================================
-- ASSIGNMENTS (crew to job)
-- ============================================================
CREATE TABLE assignments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id     UUID NOT NULL REFERENCES jobs(id)   ON DELETE CASCADE,
  crew_id    UUID NOT NULL REFERENCES crew(id)   ON DELETE CASCADE,
  client_id  UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  date       DATE NOT NULL,
  start_time TIME,
  end_time   TIME,
  notes      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_assignments_client_id ON assignments(client_id);
CREATE INDEX idx_assignments_crew_id   ON assignments(crew_id);
CREATE INDEX idx_assignments_job_id    ON assignments(job_id);
CREATE INDEX idx_assignments_date      ON assignments(date);

-- ============================================================
-- SUBCONTRACTORS
-- ============================================================
CREATE TABLE subcontractors (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id         UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  company_name      TEXT NOT NULL,
  trade             TEXT,
  phone             TEXT,
  email             TEXT,
  reliability_score INT DEFAULT 5 CHECK (reliability_score BETWEEN 1 AND 10),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_subcontractors_client_id ON subcontractors(client_id);

-- ============================================================
-- SUBCONTRACTOR SCHEDULES
-- ============================================================
CREATE TABLE sub_schedules (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_id         UUID NOT NULL REFERENCES subcontractors(id) ON DELETE CASCADE,
  job_id         UUID NOT NULL REFERENCES jobs(id)           ON DELETE CASCADE,
  scheduled_date DATE,
  status         TEXT DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'at_risk', 'completed', 'cancelled')),
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sub_schedules_sub_id ON sub_schedules(sub_id);
CREATE INDEX idx_sub_schedules_job_id ON sub_schedules(job_id);
CREATE INDEX idx_sub_schedules_date   ON sub_schedules(scheduled_date);

-- ============================================================
-- AI CONFLICT LOG
-- ============================================================
CREATE TABLE conflicts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id      UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  conflict_type  TEXT CHECK (conflict_type IN ('double_booking', 'sub_timing', 'delay_cascade')),
  description    TEXT,
  affected_jobs  UUID[] DEFAULT '{}',
  affected_crew  UUID[] DEFAULT '{}',
  ai_suggestions JSONB  DEFAULT '[]',
  resolved       BOOLEAN DEFAULT FALSE,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_conflicts_client_id ON conflicts(client_id);
CREATE INDEX idx_conflicts_resolved  ON conflicts(resolved);

-- ============================================================
-- CHAT MESSAGES (AI assistant history per client)
-- ============================================================
CREATE TABLE chat_messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id  UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_chat_messages_client_id  ON chat_messages(client_id);
CREATE INDEX idx_chat_messages_created_at ON chat_messages(created_at);

-- ============================================================
-- SMS LOG
-- ============================================================
CREATE TABLE sms_log (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id  UUID REFERENCES clients(id) ON DELETE SET NULL,
  crew_id    UUID REFERENCES crew(id)    ON DELETE SET NULL,
  direction  TEXT CHECK (direction IN ('inbound', 'outbound')),
  body       TEXT,
  processed  BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sms_log_client_id ON sms_log(client_id);
CREATE INDEX idx_sms_log_crew_id   ON sms_log(crew_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- Each client can only read/write their own rows.
-- The backend uses the service key (bypasses RLS),
-- but enabling RLS here protects against direct API misuse.
-- ============================================================

ALTER TABLE clients          ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE crew             ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcontractors   ENABLE ROW LEVEL SECURITY;
ALTER TABLE sub_schedules    ENABLE ROW LEVEL SECURITY;
ALTER TABLE conflicts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages    ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_log          ENABLE ROW LEVEL SECURITY;

-- Clients can read their own client record (email matches auth user email)
CREATE POLICY "clients: own row" ON clients
  FOR ALL USING (email = auth.jwt() ->> 'email');

-- Generic helper: all other tables key off client_id
-- The anon/authenticated role needs a matching client record.

CREATE POLICY "jobs: own client" ON jobs
  FOR ALL USING (
    client_id IN (SELECT id FROM clients WHERE email = auth.jwt() ->> 'email')
  );

CREATE POLICY "crew: own client" ON crew
  FOR ALL USING (
    client_id IN (SELECT id FROM clients WHERE email = auth.jwt() ->> 'email')
  );

CREATE POLICY "assignments: own client" ON assignments
  FOR ALL USING (
    client_id IN (SELECT id FROM clients WHERE email = auth.jwt() ->> 'email')
  );

CREATE POLICY "subcontractors: own client" ON subcontractors
  FOR ALL USING (
    client_id IN (SELECT id FROM clients WHERE email = auth.jwt() ->> 'email')
  );

CREATE POLICY "sub_schedules: own client" ON sub_schedules
  FOR ALL USING (
    job_id IN (
      SELECT j.id FROM jobs j
      JOIN clients c ON c.id = j.client_id
      WHERE c.email = auth.jwt() ->> 'email'
    )
  );

CREATE POLICY "conflicts: own client" ON conflicts
  FOR ALL USING (
    client_id IN (SELECT id FROM clients WHERE email = auth.jwt() ->> 'email')
  );

CREATE POLICY "chat_messages: own client" ON chat_messages
  FOR ALL USING (
    client_id IN (SELECT id FROM clients WHERE email = auth.jwt() ->> 'email')
  );

CREATE POLICY "sms_log: own client" ON sms_log
  FOR ALL USING (
    client_id IN (SELECT id FROM clients WHERE email = auth.jwt() ->> 'email')
  );
