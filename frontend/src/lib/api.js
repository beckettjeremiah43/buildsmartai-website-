import { supabase } from './supabase.js';

const BASE = import.meta.env.VITE_BACKEND_URL;

// ── Core fetch wrapper ────────────────────────────────────────────────────────

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
  };
}

async function request(method, path, body) {
  const headers = await authHeaders();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return null;

  const data = await res.json().catch(() => ({ error: res.statusText }));

  if (!res.ok) {
    const msg = data?.error || `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }

  return data;
}

const get    = (path)        => request('GET',    path);
const post   = (path, body)  => request('POST',   path, body);
const patch  = (path, body)  => request('PATCH',  path, body);
const del    = (path)        => request('DELETE', path);

// ── Clients ───────────────────────────────────────────────────────────────────

export const clients = {
  register:        (body)  => post('/api/clients/register', body),
  me:              ()      => get('/api/clients/me'),
  update:          (body)  => patch('/api/clients/me', body),
  generatePrompt:  ()      => post('/api/clients/generate-prompt', {}),
};

// ── Jobs ──────────────────────────────────────────────────────────────────────

export const jobs = {
  list:   (params = {}) => get(`/api/jobs?${new URLSearchParams(params)}`),
  get:    (id)          => get(`/api/jobs/${id}`),
  create: (body)        => post('/api/jobs', body),
  update: (id, body)    => patch(`/api/jobs/${id}`, body),
  remove: (id)          => del(`/api/jobs/${id}`),
};

// ── Crew ──────────────────────────────────────────────────────────────────────

export const crew = {
  list:         (params = {}) => get(`/api/crew?${new URLSearchParams(params)}`),
  get:          (id)          => get(`/api/crew/${id}`),
  create:       (body)        => post('/api/crew', body),
  update:       (id, body)    => patch(`/api/crew/${id}`, body),
  updateStatus: (id, status)  => patch(`/api/crew/${id}/status`, { status }),
  remove:       (id)          => del(`/api/crew/${id}`),
};

// ── Schedules / Assignments ───────────────────────────────────────────────────

export const schedules = {
  list:            (params = {}) => get(`/api/schedules?${new URLSearchParams(params)}`),
  snapshot:        (days = 14)   => get(`/api/schedules/snapshot?days=${days}`),
  create:          (body)        => post('/api/schedules', body),
  update:          (id, body)    => patch(`/api/schedules/${id}`, body),
  remove:          (id)          => del(`/api/schedules/${id}`),
  conflicts:       ()            => get('/api/schedules/conflicts'),
  resolveConflict: (id)          => patch(`/api/schedules/conflicts/${id}/resolve`, {}),
  runAiCheck:      ()            => post('/api/schedules/run-conflict-check', {}),
};

// ── Subcontractors ────────────────────────────────────────────────────────────

export const subcontractors = {
  list:           (params = {})           => get(`/api/subcontractors?${new URLSearchParams(params)}`),
  get:            (id)                    => get(`/api/subcontractors/${id}`),
  create:         (body)                  => post('/api/subcontractors', body),
  update:         (id, body)              => patch(`/api/subcontractors/${id}`, body),
  remove:         (id)                    => del(`/api/subcontractors/${id}`),
  getSchedules:   (id, params = {})       => get(`/api/subcontractors/${id}/schedules?${new URLSearchParams(params)}`),
  addSchedule:    (id, body)              => post(`/api/subcontractors/${id}/schedules`, body),
  updateSchedule: (scheduleId, body)      => patch(`/api/subcontractors/schedules/${scheduleId}`, body),
  removeSchedule: (scheduleId)            => del(`/api/subcontractors/schedules/${scheduleId}`),
};

// ── Payments ──────────────────────────────────────────────────────────────────

export const payments = {
  createCheckout: (tier)  => post('/api/payments/create-checkout', { tier }),
  portal:         ()      => get('/api/payments/portal'),
  status:         ()      => get('/api/payments/status'),
};

// ── Email ─────────────────────────────────────────────────────────────────────

export const email = {
  sendDailySummary: () => post('/api/email/daily-summary', {}),
  sendConflictAlert: (conflict_id) => post('/api/email/conflict-alert', { conflict_id }),
};

// ── AI ────────────────────────────────────────────────────────────────────────

export const ai = {
  chat:        (message) => post('/api/ai/chat', { message }),
  chatHistory: (limit = 50) => get(`/api/ai/chat/history?limit=${limit}`),
  draft:       (doc_type, context) => post('/api/ai/draft', { doc_type, context }),
};
