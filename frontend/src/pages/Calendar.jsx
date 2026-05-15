import { useCallback, useEffect, useState } from 'react';
import { schedules as schedulesApi, clients } from '../lib/api.js';
import Sidebar  from '../components/Sidebar.jsx';
import AIChat   from '../components/AIChat.jsx';

// ── Constants ─────────────────────────────────────────────────────────────────

const DAY_LABELS   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES  = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const JOB_COLORS   = ['#47c8ff','#22c55e','#a855f7','#f59e0b','#ec4899','#14b8a6','#f97316','#6366f1'];

// ── Helpers ───────────────────────────────────────────────────────────────────

function toIso(date) {
  return date.toISOString().split('T')[0];
}

function buildCells(year, month) {
  const firstDow   = new Date(year, month, 1).getDay();
  const daysInMo   = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const dayNum = i - firstDow + 1;
    const date   = new Date(year, month, dayNum);
    cells.push({
      dayNum,
      iso: toIso(date),
      inMonth: dayNum >= 1 && dayNum <= daysInMo,
    });
  }
  // Trim trailing empty weeks
  while (cells.length > 35 && cells.slice(-7).every(c => !c.inMonth)) {
    cells.splice(-7);
  }
  return cells;
}

// ── Event helpers ─────────────────────────────────────────────────────────────

function jobsOnDate(jobs, iso) {
  return jobs.filter(j => j.start_date && j.end_date && j.start_date <= iso && j.end_date >= iso);
}

function subsOnDate(subs, iso) {
  return subs.filter(s => s.scheduled_date === iso);
}

function assignsOnDate(assigns, iso) {
  return assigns.filter(a => (a.date ?? a.scheduled_date) === iso);
}

// ── Day cell ──────────────────────────────────────────────────────────────────

function DayCell({ cell, jobs, subs, assigns, conflicts, jobColors, isSelected, onSelect, todayIso }) {
  if (!cell.inMonth) {
    return <div className="min-h-[88px] bg-gray-50/40 border-b border-r border-gray-100" />;
  }

  const dayJobs    = jobsOnDate(jobs, cell.iso);
  const daySubs    = subsOnDate(subs, cell.iso);
  const dayAssigns = assignsOnDate(assigns, cell.iso);
  const isToday    = cell.iso === todayIso;
  const hasConflict = conflicts.some(c =>
    c.affected_jobs?.some(jid => dayJobs.find(j => j.id === jid))
  );

  return (
    <div
      onClick={() => onSelect(cell.iso)}
      className="min-h-[88px] p-1.5 border-b border-r border-gray-100 cursor-pointer transition-colors hover:bg-fog/60"
      style={isSelected ? { background: 'rgba(71,200,255,0.06)', outline: '1px solid rgba(71,200,255,0.3)', outlineOffset: '-1px' } : {}}
    >
      {/* Day number */}
      <div
        className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold mb-1 select-none"
        style={isToday
          ? { background: 'linear-gradient(135deg,#47c8ff,#6366f1)', color: '#fff' }
          : { color: '#0d0d0d' }
        }
      >
        {cell.dayNum}
      </div>

      {/* Job bars */}
      {dayJobs.slice(0, 2).map(job => (
        <div
          key={job.id}
          className="rounded text-[9px] font-medium px-1 py-0.5 mb-0.5 truncate leading-tight"
          style={{
            background: `${jobColors[job.id]}22`,
            color: jobColors[job.id],
            border: `1px solid ${jobColors[job.id]}44`,
          }}
          title={job.name}
        >
          {job.name}
        </div>
      ))}

      {/* Dot indicators */}
      {(daySubs.length > 0 || dayAssigns.length > 0 || hasConflict || dayJobs.length > 2) && (
        <div className="flex flex-wrap gap-0.5 mt-0.5">
          {dayJobs.slice(2).map((_, i) => (
            <span key={`j${i}`} className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#47c8ff' }} title="Job" />
          ))}
          {daySubs.slice(0, 4).map((_, i) => (
            <span key={`s${i}`} className="w-1.5 h-1.5 rounded-full bg-purple-400 flex-shrink-0" title="Sub visit" />
          ))}
          {dayAssigns.slice(0, 4).map((_, i) => (
            <span key={`a${i}`} className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" title="Assignment" />
          ))}
          {hasConflict && (
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" title="Conflict" />
          )}
        </div>
      )}
    </div>
  );
}

// ── Day detail panel ──────────────────────────────────────────────────────────

function DayDetail({ iso, jobs, subs, assigns, conflicts, jobColors }) {
  const dayJobs    = jobsOnDate(jobs, iso);
  const daySubs    = subsOnDate(subs, iso);
  const dayAssigns = assignsOnDate(assigns, iso);
  const hasConflict = conflicts.some(c =>
    c.affected_jobs?.some(jid => dayJobs.find(j => j.id === jid))
  );
  const empty = dayJobs.length === 0 && daySubs.length === 0 && dayAssigns.length === 0;

  const displayDate = new Date(iso + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  return (
    <div className="bg-white rounded-xl border border-rule shadow-sm p-4">
      <h3 className="text-xs font-semibold text-ink mb-3">{displayDate}</h3>

      {hasConflict && (
        <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2 mb-3">
          <p className="text-xs text-red-600 font-medium">⚠ Conflict on this day</p>
        </div>
      )}

      {empty ? (
        <p className="text-xs text-muted">Nothing scheduled.</p>
      ) : (
        <div className="space-y-4">
          {dayJobs.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-2">Jobs</p>
              <div className="space-y-1.5">
                {dayJobs.map(job => (
                  <div key={job.id} className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: jobColors[job.id] }} />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-ink truncate">{job.name}</p>
                      {job.address && <p className="text-[10px] text-muted truncate">{job.address}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {daySubs.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-2">Sub Visits</p>
              <div className="space-y-1.5">
                {daySubs.map((s, i) => (
                  <div key={i} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2 h-2 rounded-full bg-purple-400 flex-shrink-0" />
                      <p className="text-xs text-ink truncate">{s.trade ?? s.sub_name ?? 'Sub contractor'}</p>
                    </div>
                    {s.confirmed !== undefined && (
                      <span className={`pill flex-shrink-0 ${s.confirmed ? 'pill-green' : 'pill-amber'}`}>
                        {s.confirmed ? 'Confirmed' : 'Pending'}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {dayAssigns.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-2">Crew Assignments</p>
              <div className="space-y-1.5">
                {dayAssigns.map((a, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
                    <p className="text-xs text-ink truncate">{a.crew_name ?? 'Crew member'}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Calendar page ─────────────────────────────────────────────────────────────

export default function Calendar() {
  const [snapshot,     setSnapshot]     = useState({ jobs: [], assignments: [], subSchedules: [] });
  const [conflicts,    setConflicts]    = useState([]);
  const [client,       setClient]       = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [selectedIso,  setSelectedIso]  = useState(null);
  const [chatOpen,     setChatOpen]     = useState(false);

  const [viewDate, setViewDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const fetchAll = useCallback(async () => {
    try {
      const [snap, confs, clientData] = await Promise.all([
        schedulesApi.snapshot(365),
        schedulesApi.conflicts(),
        clients.me(),
      ]);
      setSnapshot(snap);
      setConflicts(confs);
      setClient(clientData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const year  = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const cells = buildCells(year, month);

  const todayIso = toIso(new Date());

  // Stable job color map
  const jobColors = {};
  snapshot.jobs.forEach((job, i) => {
    jobColors[job.id] = JOB_COLORS[i % JOB_COLORS.length];
  });

  function prevMonth() {
    setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
    setSelectedIso(null);
  }
  function nextMonth() {
    setViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));
    setSelectedIso(null);
  }
  function goToday() {
    const d = new Date();
    setViewDate(new Date(d.getFullYear(), d.getMonth(), 1));
    setSelectedIso(todayIso);
  }

  function handleSelect(iso) {
    setSelectedIso(prev => (prev === iso ? null : iso));
  }

  const activeJobs = snapshot.jobs.filter(j => j.status === 'active');

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
        <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-rule">
          <div>
            <h1 className="text-sm font-semibold text-ink">Calendar</h1>
            <p className="text-xs text-muted mt-0.5">Month-by-month schedule view</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={goToday} className="btn-secondary text-xs py-1.5 px-3">Today</button>
            <button onClick={prevMonth} className="btn-secondary text-xs py-1.5 px-3">‹</button>
            <span className="text-sm font-semibold text-ink min-w-[160px] text-center">
              {MONTH_NAMES[month]} {year}
            </span>
            <button onClick={nextMonth} className="btn-secondary text-xs py-1.5 px-3">›</button>
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <main className="flex-1 p-6 flex gap-5 min-h-0">

            {/* Calendar grid */}
            <div className="flex-1 bg-white rounded-xl border border-rule shadow-sm overflow-hidden flex flex-col">
              {/* Day-of-week header */}
              <div className="grid grid-cols-7 border-b border-rule flex-shrink-0">
                {DAY_LABELS.map(d => (
                  <div key={d} className="py-2 text-center text-[10px] font-semibold text-muted uppercase tracking-wider">
                    {d}
                  </div>
                ))}
              </div>

              {/* Cells */}
              <div className="grid grid-cols-7 flex-1">
                {cells.map((cell, i) => (
                  <DayCell
                    key={i}
                    cell={cell}
                    jobs={snapshot.jobs}
                    subs={snapshot.subSchedules}
                    assigns={snapshot.assignments}
                    conflicts={conflicts}
                    jobColors={jobColors}
                    isSelected={cell.iso === selectedIso}
                    onSelect={handleSelect}
                    todayIso={todayIso}
                  />
                ))}
              </div>
            </div>

            {/* Right panel */}
            <div className="w-60 flex-shrink-0 flex flex-col gap-4">

              {/* Selected day detail */}
              {selectedIso && (
                <DayDetail
                  iso={selectedIso}
                  jobs={snapshot.jobs}
                  subs={snapshot.subSchedules}
                  assigns={snapshot.assignments}
                  conflicts={conflicts}
                  jobColors={jobColors}
                />
              )}

              {/* Legend */}
              <div className="bg-white rounded-xl border border-rule shadow-sm p-4">
                <h3 className="text-xs font-semibold text-ink mb-3">Legend</h3>
                <div className="space-y-2">
                  {[
                    [null,        'Active job',        '#47c8ff',  'rounded-sm'],
                    ['bg-purple-400', 'Sub visit',     null,       'rounded-full'],
                    ['bg-green-400',  'Crew assignment',null,      'rounded-full'],
                    ['bg-red-500',    'Conflict',      null,       'rounded-full'],
                  ].map(([cls, label, bg, shape]) => (
                    <div key={label} className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 flex-shrink-0 ${cls ?? ''} ${shape}`}
                        style={bg ? { background: bg } : {}}
                      />
                      <span className="text-xs text-muted">{label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Active jobs color key */}
              {activeJobs.length > 0 && (
                <div className="bg-white rounded-xl border border-rule shadow-sm p-4">
                  <h3 className="text-xs font-semibold text-ink mb-3">Active jobs</h3>
                  <div className="space-y-2">
                    {activeJobs.slice(0, 7).map(job => (
                      <div key={job.id} className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: jobColors[job.id] }} />
                        <span className="text-xs text-ink truncate">{job.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </main>
        )}
      </div>

      <AIChat
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
      />
    </div>
  );
}
