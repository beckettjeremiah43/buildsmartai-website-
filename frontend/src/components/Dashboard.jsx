import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { schedules as schedulesApi, crew as crewApi, clients } from '../lib/api.js';
import Sidebar        from './Sidebar.jsx';
import ConflictAlerts from './ConflictAlerts.jsx';
import GanttChart     from './GanttChart.jsx';
import CrewPanel      from './CrewPanel.jsx';
import AIChat         from './AIChat.jsx';
import PnLChart       from './PnLChart.jsx';

// ── Helpers ───────────────────────────────────────────────────────────────────

function toIso(date) {
  return date.toISOString().split('T')[0];
}

const WEEKDAY = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTH   = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ── Metric card ───────────────────────────────────────────────────────────────

const METRIC_ACCENTS = ['#47c8ff', '#22c55e', '#ef4444', '#f59e0b'];
const METRIC_ICON_GRADS = [
  'linear-gradient(135deg,#47c8ff,#0ea5e9)',
  'linear-gradient(135deg,#22c55e,#16a34a)',
  'linear-gradient(135deg,#ef4444,#dc2626)',
  'linear-gradient(135deg,#f59e0b,#d97706)',
];

function MetricCard({ icon, label, value, sub, index }) {
  return (
    <div className="bg-white rounded-xl border border-rule overflow-hidden shadow-sm"
      style={{ borderTop: `3px solid ${METRIC_ACCENTS[index] ?? '#e8e8e8'}` }}>
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <p className="text-[11px] font-medium text-muted uppercase tracking-wider leading-tight">{label}</p>
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

// ── Job row ───────────────────────────────────────────────────────────────────

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

  // Timeline progress
  const today = new Date(); today.setHours(0,0,0,0);
  const start = job.start_date ? new Date(job.start_date + 'T00:00:00') : null;
  const end   = job.end_date   ? new Date(job.end_date   + 'T00:00:00') : null;
  let progress = null;
  if (start && end && end > start) {
    progress = Math.min(100, Math.max(0, Math.round(((today - start) / (end - start)) * 100)));
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-fog/50 transition-colors">
      <div className="w-0.5 h-8 rounded-full flex-shrink-0" style={{ background: barColor }} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-ink truncate">{job.name}</p>
        {progress !== null ? (
          <div className="flex items-center gap-1.5 mt-1">
            <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${progress}%`, background: barColor }} />
            </div>
            <span className="text-[10px] text-muted flex-shrink-0">{progress}%</span>
          </div>
        ) : job.address ? (
          <p className="text-xs text-muted mt-0.5 truncate">{job.address}</p>
        ) : null}
      </div>
      {hasConflict ? (
        <span className="pill pill-red flex-shrink-0">⚠ Conflict</span>
      ) : (
        <span className="pill pill-green flex-shrink-0">On track</span>
      )}
    </div>
  );
}

// ── Upcoming panel ────────────────────────────────────────────────────────────

function UpcomingPanel({ subSchedules, jobs, assignments }) {
  const today = new Date(); today.setHours(0,0,0,0);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const iso = toIso(d);
    return {
      iso,
      date:    d,
      label:   i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : WEEKDAY[d.getDay()],
      dayNum:  d.getDate(),
      month:   MONTH[d.getMonth()],
      subs:    subSchedules.filter(s => s.scheduled_date === iso),
      assigns: assignments.filter(a => (a.date ?? a.scheduled_date) === iso),
      ending:  jobs.filter(j => j.end_date === iso),
      isToday: i === 0,
    };
  });

  const hasAny = days.some(d => d.subs.length + d.assigns.length + d.ending.length > 0);

  return (
    <div className="bg-white rounded-xl border border-rule shadow-sm overflow-hidden flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50 flex-shrink-0">
        <h2 className="text-sm font-semibold text-ink">Upcoming</h2>
        <Link to="/calendar" className="text-xs text-brand-500 hover:text-brand-600 font-medium">
          Full calendar →
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
        {!hasAny ? (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-muted mb-1">Nothing scheduled this week</p>
            <Link to="/calendar" className="text-xs text-brand-500 hover:text-brand-600">
              Open calendar →
            </Link>
          </div>
        ) : (
          days.map(day => {
            const total = day.subs.length + day.assigns.length + day.ending.length;
            if (!day.isToday && total === 0) return null;
            return (
              <div key={day.iso} className={`px-4 py-3 ${day.isToday ? 'bg-brand-50/30' : ''}`}>
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-7 h-7 rounded-lg flex flex-col items-center justify-center flex-shrink-0 text-white
                    ${day.isToday ? '' : 'bg-gray-100'}`}
                    style={day.isToday ? { background: 'linear-gradient(135deg,#47c8ff,#6366f1)' } : {}}>
                    <span className={`text-[9px] font-bold leading-none ${day.isToday ? 'text-white' : 'text-muted'}`}>
                      {day.month.toUpperCase()}
                    </span>
                    <span className={`text-[11px] font-bold leading-none ${day.isToday ? 'text-white' : 'text-ink'}`}>
                      {day.dayNum}
                    </span>
                  </div>
                  <span className={`text-xs font-semibold ${day.isToday ? 'text-brand-600' : 'text-ink'}`}>
                    {day.label}
                  </span>
                  {total > 0 && (
                    <span className="text-[10px] text-muted ml-auto">{total} event{total !== 1 ? 's' : ''}</span>
                  )}
                </div>

                {total === 0 ? (
                  <p className="text-xs text-muted pl-9">No events</p>
                ) : (
                  <div className="pl-9 space-y-1.5">
                    {day.ending.map(job => (
                      <div key={job.id} className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-400 flex-shrink-0" />
                        <span className="text-xs text-ink truncate">{job.name}</span>
                        <span className="text-[10px] text-orange-500 font-medium flex-shrink-0 ml-auto">due</span>
                      </div>
                    ))}
                    {day.subs.map((s, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-400 flex-shrink-0" />
                        <span className="text-xs text-ink truncate">
                          {s.trade ?? s.subcontractors?.company_name ?? 'Sub visit'}
                        </span>
                        {s.confirmed !== undefined && (
                          <span className={`text-[10px] font-medium flex-shrink-0 ml-auto ${s.confirmed ? 'text-green-500' : 'text-amber-500'}`}>
                            {s.confirmed ? '✓' : 'pending'}
                          </span>
                        )}
                      </div>
                    ))}
                    {day.assigns.map((a, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
                        <span className="text-xs text-ink truncate">{a.crew_name ?? a.crew?.name ?? 'Crew assigned'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Quick actions footer */}
      <div className="flex border-t border-gray-50 flex-shrink-0">
        {[
          { to: '/jobs',     label: '+ New job',  half: true },
          { to: '/calendar', label: 'Schedule',   half: true },
        ].map(({ to, label }) => (
          <Link
            key={to}
            to={to}
            className="flex-1 text-center text-xs font-medium text-muted hover:text-ink hover:bg-fog py-2.5 transition-colors border-r border-gray-50 last:border-0"
          >
            {label}
          </Link>
        ))}
      </div>
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
        {[1,2,3,4].map(i => <Skeleton key={i} className="h-24" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Skeleton className="lg:col-span-2 h-56" />
        <Skeleton className="h-56" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <Skeleton className="lg:col-span-3 h-64" />
        <Skeleton className="lg:col-span-2 h-64" />
      </div>
      <Skeleton className="h-52" />
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

  // Derived metrics
  const today    = new Date().toISOString().split('T')[0];
  const nextWeek = new Date(Date.now() + 7 * 86_400_000).toISOString().split('T')[0];

  const activeJobs   = snapshot.jobs.filter(j => j.status === 'active').length;
  const crewOnSite   = crewList.filter(c => c.status === 'on_site').length;
  const subsThisWeek = snapshot.subSchedules.filter(
    s => s.scheduled_date >= today && s.scheduled_date <= nextWeek,
  ).length;

  const conflictJobIds = new Set(conflicts.flatMap(c => c.affected_jobs ?? []));

  const metrics = [
    { icon: '📋', label: 'Active Jobs',    value: activeJobs,       sub: `${snapshot.jobs.filter(j=>j.status==='paused').length} paused` },
    { icon: '👷', label: 'Crew On Site',   value: crewOnSite,       sub: `${crewList.length} total crew` },
    { icon: '⚠',  label: 'Conflicts',      value: conflicts.length, sub: conflicts.length > 0 ? 'Needs attention' : 'All clear' },
    { icon: '📅', label: 'Subs This Week', value: subsThisWeek,     sub: 'scheduled visits' },
  ];

  const greeting = (() => {
    const h = new Date().getHours();
    return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
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
            <button onClick={() => setChatOpen(true)} className="btn-primary text-xs py-1.5 px-3">
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
          <main className="flex-1 p-6 space-y-5">

            {/* ── Row 1: Metric cards ───────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {metrics.map((m, i) => (
                <MetricCard key={m.label} {...m} index={i} />
              ))}
            </div>

            {/* ── Row 2: Conflict alerts (only when present) ────────────── */}
            <ConflictAlerts
              conflicts={conflicts}
              onResolve={handleResolve}
              onAskAI={handleAskAI}
            />

            {/* ── Row 3: P&L chart + Upcoming panel ────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5" style={{ minHeight: 280 }}>
              <div className="lg:col-span-2">
                <PnLChart />
              </div>
              <div className="lg:col-span-1">
                <UpcomingPanel
                  subSchedules={snapshot.subSchedules}
                  jobs={snapshot.jobs}
                  assignments={snapshot.assignments}
                />
              </div>
            </div>

            {/* ── Row 4: Active jobs + Crew ─────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
              {/* Active jobs */}
              <div className="lg:col-span-3 bg-white rounded-xl border border-rule shadow-sm overflow-hidden flex flex-col">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50 flex-shrink-0">
                  <h2 className="text-sm font-semibold text-ink">Active jobs</h2>
                  <Link to="/jobs" className="text-xs text-brand-500 hover:text-brand-600 font-medium">
                    View all →
                  </Link>
                </div>
                {snapshot.jobs.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center py-10 text-center px-6">
                    <p className="text-sm text-muted mb-3">No active jobs yet.</p>
                    <Link to="/jobs" className="btn-primary text-xs py-1.5 px-4">+ Create your first job</Link>
                  </div>
                ) : (
                  <>
                    {snapshot.jobs.slice(0, 6).map((job, i) => (
                      <JobRow
                        key={job.id}
                        job={job}
                        index={i}
                        hasConflict={conflictJobIds.has(job.id)}
                      />
                    ))}
                    {snapshot.jobs.length > 6 && (
                      <Link to="/jobs" className="block text-center text-xs text-muted hover:text-ink py-2.5 border-t border-gray-50 transition-colors">
                        +{snapshot.jobs.length - 6} more jobs →
                      </Link>
                    )}
                  </>
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

            {/* ── Row 5: Gantt chart ────────────────────────────────────── */}
            <GanttChart jobs={snapshot.jobs} conflicts={conflicts} />

          </main>
        )}
      </div>

      {/* Floating AI chat button */}
      <button
        onClick={() => setChatOpen(true)}
        className={`fixed bottom-6 right-6 z-40 shadow-lg hover:shadow-xl text-lg flex items-center justify-center transition-all duration-200 ${chatOpen ? 'scale-0 opacity-0' : 'scale-100 opacity-100'}`}
        style={{ width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg,#47c8ff,#6366f1)', color: '#0d0d0d' }}
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
