import { useState } from 'react';

// ── Date utilities ────────────────────────────────────────────────────────────

function parseDate(str) {
  if (!str) return null;
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function getMonday(date) {
  const d   = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth()    === b.getMonth()    &&
         a.getDate()     === b.getDate();
}

const DAY_LABELS   = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ── Bar color logic ───────────────────────────────────────────────────────────

function barColor(job, conflicts, today) {
  const hasConflict = conflicts.some(c => c.affected_jobs?.includes(job.id));
  if (hasConflict) return { bg: 'bg-red-500',   text: 'text-white', label: 'conflict' };

  const end = parseDate(job.end_date);
  if (end && end < today) return { bg: 'bg-amber-400', text: 'text-white', label: 'overdue'  };

  return { bg: 'bg-green-500', text: 'text-white', label: 'on track' };
}

// ── Job detail popover ────────────────────────────────────────────────────────

function JobPopover({ job, color, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20" />
      <div className="relative card p-5 w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-semibold text-gray-900">{job.name}</h3>
            {job.address && <p className="text-xs text-gray-500 mt-0.5">{job.address}</p>}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none ml-3">×</button>
        </div>

        <div className="flex items-center gap-2 mb-3">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full text-white ${color.bg}`}>
            {color.label}
          </span>
          <span className="text-xs text-gray-500 capitalize">{job.status}</span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 mb-3">
          <div>
            <p className="font-medium text-gray-700">Start</p>
            <p>{job.start_date || '—'}</p>
          </div>
          <div>
            <p className="font-medium text-gray-700">End</p>
            <p>{job.end_date || '—'}</p>
          </div>
        </div>

        {Array.isArray(job.phases) && job.phases.length > 0 && (
          <div>
            <p className="text-xs font-medium text-gray-700 mb-1.5">Phases</p>
            <div className="flex flex-wrap gap-1.5">
              {job.phases.map((p, i) => (
                <span key={i} className={`text-xs px-2 py-0.5 rounded-full border
                  ${p.status === 'complete'    ? 'bg-green-50 text-green-700 border-green-200' :
                    p.status === 'in_progress' ? 'bg-blue-50 text-blue-700 border-blue-200'  :
                    'bg-gray-100 text-gray-500 border-gray-200'}`}>
                  {p.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {job.notes && (
          <p className="text-xs text-gray-500 italic mt-3">{job.notes}</p>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function GanttChart({ jobs = [], conflicts = [] }) {
  const [selected, setSelected] = useState(null);

  const today    = new Date(); today.setHours(0, 0, 0, 0);
  const monday   = getMonday(today);
  const weekDays = DAY_LABELS.map((label, i) => ({ label, date: addDays(monday, i) }));

  const activeJobs = jobs.filter(j => j.status === 'active');

  // For each job compute bar position within the 5-day grid
  function computeBar(job) {
    const start = parseDate(job.start_date);
    const end   = parseDate(job.end_date);
    if (!start || !end) return { left: 0, width: 100, visible: true }; // spans full week if no dates

    const friday = addDays(monday, 4);

    // Job entirely outside this week
    if (end < monday || start > friday) return { visible: false };

    const clampedStart = start < monday ? monday : start;
    const clampedEnd   = end   > friday ? friday : end;

    const startOffset = Math.round((clampedStart - monday) / 86400000);
    const endOffset   = Math.round((clampedEnd   - monday) / 86400000);

    const left  = (startOffset / 5) * 100;
    const width = ((endOffset - startOffset + 1) / 5) * 100;

    return { left, width, visible: true };
  }

  const monthLabel = (() => {
    const m = monday.getMonth();
    const y = monday.getFullYear();
    return `${MONTH_LABELS[m]} ${y}`;
  })();

  const selectedJob   = jobs.find(j => j.id === selected);
  const selectedColor = selectedJob ? barColor(selectedJob, conflicts, today) : null;

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div>
          <h2 className="font-semibold text-gray-900">Schedule — This Week</h2>
          <p className="text-xs text-gray-400 mt-0.5">{monthLabel}</p>
        </div>
        {/* Legend */}
        <div className="flex items-center gap-3">
          {[
            { color: 'bg-green-500',  label: 'On track' },
            { color: 'bg-amber-400',  label: 'Overdue'  },
            { color: 'bg-red-500',    label: 'Conflict' },
          ].map(l => (
            <div key={l.label} className="flex items-center gap-1">
              <span className={`w-2.5 h-2.5 rounded-sm ${l.color}`} />
              <span className="text-xs text-gray-500 hidden sm:block">{l.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Day header */}
      <div className="flex border-b border-gray-100">
        {/* Row label gutter */}
        <div className="w-36 flex-shrink-0 px-4 py-2">
          <span className="text-xs text-gray-400">Job</span>
        </div>
        {/* Day columns */}
        <div className="flex-1 grid grid-cols-5">
          {weekDays.map(({ label, date }) => {
            const isToday = sameDay(date, today);
            return (
              <div
                key={label}
                className={`px-1 py-2 text-center border-l border-gray-100
                  ${isToday ? 'bg-brand-50' : ''}`}
              >
                <p className={`text-xs font-medium ${isToday ? 'text-brand-600' : 'text-gray-500'}`}>
                  {label}
                </p>
                <p className={`text-xs ${isToday ? 'text-brand-500 font-bold' : 'text-gray-400'}`}>
                  {date.getDate()}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Rows */}
      <div className="divide-y divide-gray-50">
        {activeJobs.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-sm text-gray-400">No active jobs scheduled this week.</p>
          </div>
        ) : (
          activeJobs.map(job => {
            const bar   = computeBar(job);
            const color = barColor(job, conflicts, today);

            return (
              <div key={job.id} className="flex items-center min-h-[48px]">
                {/* Job name */}
                <div className="w-36 flex-shrink-0 px-4 py-2">
                  <p className="text-xs font-medium text-gray-700 truncate" title={job.name}>
                    {job.name}
                  </p>
                  {job.address && (
                    <p className="text-xs text-gray-400 truncate">{job.address.split(',')[0]}</p>
                  )}
                </div>

                {/* Bar area */}
                <div className="flex-1 relative h-12 border-l border-gray-100">
                  {/* Today highlight */}
                  {weekDays.map(({ date }, i) => sameDay(date, today) ? (
                    <div
                      key={i}
                      className="absolute inset-y-0 bg-brand-50/50"
                      style={{ left: `${(i / 5) * 100}%`, width: '20%' }}
                    />
                  ) : null)}

                  {/* Grid lines */}
                  {[1, 2, 3, 4].map(i => (
                    <div
                      key={i}
                      className="absolute inset-y-0 border-l border-gray-100"
                      style={{ left: `${(i / 5) * 100}%` }}
                    />
                  ))}

                  {/* Job bar */}
                  {bar.visible && (
                    <button
                      onClick={() => setSelected(job.id)}
                      className={`
                        absolute top-1/2 -translate-y-1/2 h-7 rounded-md
                        ${color.bg} ${color.text}
                        text-xs font-medium px-2 truncate
                        hover:opacity-90 hover:shadow-sm
                        transition-all cursor-pointer
                        flex items-center
                      `}
                      style={{
                        left:  `calc(${bar.left}% + 2px)`,
                        width: `calc(${bar.width}% - 4px)`,
                      }}
                      title={job.name}
                    >
                      <span className="truncate">{job.name}</span>
                    </button>
                  )}

                  {!bar.visible && (
                    <div className="absolute inset-0 flex items-center px-2">
                      <span className="text-xs text-gray-300 italic">Not scheduled this week</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Job detail popover */}
      {selected && selectedJob && (
        <JobPopover
          job={selectedJob}
          color={selectedColor}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
