import { useEffect, useState, useCallback } from 'react';
import { schedules as schedulesApi, crew as crewApi, clients } from '../lib/api.js';
import Sidebar        from './Sidebar.jsx';
import ConflictAlerts from './ConflictAlerts.jsx';
import GanttChart     from './GanttChart.jsx';
import CrewPanel      from './CrewPanel.jsx';
import JobBoard       from './JobBoard.jsx';
import AIChat         from './AIChat.jsx';
import PnLChart       from './PnLChart.jsx';

// ── Metric card ───────────────────────────────────────────────────────────────

const METRIC_ACCENTS = ['#47c8ff', '#22c55e', '#ef4444', '#f59e0b'];
const METRIC_ICON_GRADS = [
  'linear-gradient(135deg,#47c8ff,#0ea5e9)',
  'linear-gradient(135deg,#22c55e,#16a34a)',
  'linear-gradient(135deg,#ef4444,#dc2626)',
  'linear-gradient(135deg,#f59e0b,#d97706)',
];

function MetricCard({ icon, label, value, sub, accent, index }) {
  return (
    <div className="bg-white rounded-xl border border-rule overflow-hidden shadow-sm"
      style={{ borderTop: `3px solid ${METRIC_ACCENTS[index] ?? '#e8e8e8'}` }}>
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <p className="text-[11px] font-medium text-muted uppercase tracking-wider">{label}</p>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
            style={{ background: METRIC_ICON_GRADS[index] ?? '#e8e8e8' }}>
            <span>{icon}</span>
          </div>
        </div>
        <p className="font-display italic text-3xl text-ink leading-none mb-1"
          style={{ fontFamily: 'Instrument Serif, Georgia, serif' }}>
          {value}
        </p>
        {sub && <p className="text-xs text-muted mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── Job row (dashboard panel) ─────────────────────────────────────────────────

const JOB_BAR_COLORS = [
  'linear-gradient(135deg,#47c8ff,#818cf8)',
  'linear-gradient(135deg,#22c55e,#14b8a6)',
  'linear-gradient(135deg,#f59e0b,#eab308)',
  'linear-gradient(135deg,#ef4444,#f97316)',
  'linear-gradient(135deg,#a855f7,#ec4899)',
];

function JobRow({ job, index, hasConflict }) {
  const barColor = hasConflict
    ? 'linear-gradient(135deg,#ef4444,#f97316)'
    : JOB_BAR_COLORS[index % JOB_BAR_COLORS.length];

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-fog/50 transition-colors">
      <div className="w-0.5 h-8 rounded-full flex-shrink-0" style={{ background: barColor }} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-ink truncate">{job.name}</p>
        {job.address && (
          <p className="text-xs text-muted mt-0.5 truncate">{job.address}</p>
        )}
      </div>
      {hasConflict ? (
        <span className="pill pill-red flex-shrink-0">⚠ Conflict</span>
      ) : (
        <span className="pill pill-green flex-shrink-0">On track</span>
      )}
    </div>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function Skeleton({ className }) {
  return <div className={`animate-pulse bg-gray-200 rounded-lg ${className}`} />;
}

function DashboardSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1,2,3,4].map(i => <Skeleton key={i} className="h-28" />)}
      </div>
      <Skeleton className="h-32" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Skeleton className="lg:col-span-2 h-64" />
        <Skeleton className="h-64" />
      </div>
      <Skeleton className="h-48" />
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [snapshot,  setSnapshot]  = useState({ jobs: [], assignments: [], subSchedules: [] });
  const [conflicts, setConflicts] = useState([]);
  const [crewList,  setCrewList]  = useState([]);
  const [client,    setClient]    = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [chatOpen,  setChatOpen]  = useState(false);
  const [prefill,   setPrefill]   = useState('');

  const fetchAll = useCallback(async () => {
    try {
      const [snap, confs, crewData, clientData] = await Promise.all([
        schedulesApi.snapshot(14),
        schedulesApi.conflicts(),
        crewApi.list(),
        clients.me(),
      ]);
      setSnapshot(snap);
      setConflicts(confs);
      setCrewList(crewData);
      setClient(clientData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function handleResolve(conflictId) {
    await schedulesApi.resolveConflict(conflictId);
    setConflicts(cs => cs.filter(c => c.id !== conflictId));
  }

  function handleAskAI(message) {
    setPrefill(message);
    setChatOpen(true);
  }

  // ── Derived metrics ─────────────────────────────────────────────────────────
  const today    = new Date().toISOString().split('T')[0];
  const nextWeek = new Date(Date.now() + 7 * 86_400_000).toISOString().split('T')[0];

  const activeJobs   = snapshot.jobs.filter(j => j.status === 'active').length;
  const crewOnSite   = crewList.filter(c => c.status === 'on_site').length;
  const subsThisWeek = snapshot.subSchedules.filter(
    s => s.scheduled_date >= today && s.scheduled_date <= nextWeek,
  ).length;

  const conflictJobIds = new Set(conflicts.flatMap(c => c.affected_jobs ?? []));

  const metrics = [
    { icon: '📋', label: 'Active Jobs',     value: activeJobs,        sub: `${snapshot.jobs.filter(j => j.status === 'paused').length} paused`  },
    { icon: '👷', label: 'Crew On Site',    value: crewOnSite,        sub: `${crewList.length} total crew` },
    { icon: '⚠',  label: 'Conflicts',       value: conflicts.length,  sub: conflicts.length > 0 ? 'Needs attention' : 'All clear' },
    { icon: '📅', label: 'Subs This Week',  value: subsThisWeek,      sub: 'scheduled visits' },
  ];

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'morning';
    if (h < 17) return 'afternoon';
    return 'evening';
  })();

  return (
    <div className="flex min-h-screen bg-paper">
      <Sidebar
        companyName={client?.company_name}
        ownerName={client?.owner_name}
        onOpenAI={() => setChatOpen(true)}
        conflictCount={conflicts.length}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-rule"
          style={{ background: 'linear-gradient(90deg,white 60%,#f0f9ff 100%)' }}>
          <div>
            <h1 className="text-sm font-semibold text-ink">
              Good {greeting}, {client?.owner_name?.split(' ')[0] ?? 'there'}.
            </h1>
            <p className="text-xs text-muted mt-0.5">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {conflicts.length > 0 && (
              <span className="hidden sm:flex items-center gap-1.5 text-xs text-red-600 font-medium bg-red-50 border border-red-100 px-2.5 py-1.5 rounded-lg">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                {conflicts.length} conflict{conflicts.length !== 1 ? 's' : ''}
              </span>
            )}
            <button
              onClick={() => setChatOpen(true)}
              className="btn-primary text-xs py-1.5 px-3"
            >
              Ask AI
            </button>
          </div>
        </div>

        {loading ? (
          <DashboardSkeleton />
        ) : error ? (
          <div className="p-12 text-center">
            <p className="text-red-600 text-sm">{error}</p>
            <button onClick={fetchAll} className="btn-primary mt-4">Retry</button>
          </div>
        ) : (
          <main className="flex-1 p-6 space-y-6">

            {/* Metric cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {metrics.map((m, i) => (
                <MetricCard key={m.label} {...m} index={i} />
              ))}
            </div>

            {/* Conflict alerts */}
            <ConflictAlerts
              conflicts={conflicts}
              onResolve={handleResolve}
              onAskAI={handleAskAI}
            />

            {/* P&L chart */}
            <PnLChart />

            {/* Jobs + Alerts two-col */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              {/* Active jobs panel */}
              <div className="lg:col-span-3 bg-white rounded-xl border border-rule shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
                  <h2 className="text-sm font-semibold text-ink">Active jobs</h2>
                  <span className="text-xs text-muted">{snapshot.jobs.length} total</span>
                </div>
                {snapshot.jobs.length === 0 ? (
                  <p className="px-4 py-8 text-sm text-muted text-center">No active jobs.</p>
                ) : (
                  snapshot.jobs.slice(0, 6).map((job, i) => (
                    <JobRow
                      key={job.id}
                      job={job}
                      index={i}
                      hasConflict={conflictJobIds.has(job.id)}
                    />
                  ))
                )}
              </div>

              {/* Crew panel */}
              <div className="lg:col-span-2">
                <CrewPanel
                  crew={crewList}
                  assignments={snapshot.assignments}
                  onRefresh={fetchAll}
                />
              </div>
            </div>

            {/* Gantt */}
            <GanttChart jobs={snapshot.jobs} conflicts={conflicts} />

            {/* Job board */}
            <JobBoard jobs={snapshot.jobs} />
          </main>
        )}
      </div>

      {/* Floating AI chat button */}
      <button
        onClick={() => setChatOpen(true)}
        className={`
          fixed bottom-6 right-6 z-40
          w-13 h-13 rounded-full
          shadow-lg hover:shadow-xl
          text-lg
          flex items-center justify-center
          transition-all duration-200
          ${chatOpen ? 'scale-0 opacity-0' : 'scale-100 opacity-100'}
        `}
        style={{
          width: 52, height: 52,
          background: 'linear-gradient(135deg,#47c8ff,#6366f1)',
          color: '#0d0d0d',
        }}
        aria-label="Open AI assistant"
      >
        🤖
      </button>

      <AIChat
        isOpen={chatOpen}
        onClose={() => { setChatOpen(false); setPrefill(''); }}
        prefillMessage={prefill}
      />
    </div>
  );
}
