import { useEffect, useState, useCallback } from 'react';
import { schedules as schedulesApi, crew as crewApi, clients } from '../lib/api.js';
import Navbar         from './Navbar.jsx';
import ConflictAlerts from './ConflictAlerts.jsx';
import GanttChart     from './GanttChart.jsx';
import CrewPanel      from './CrewPanel.jsx';
import JobBoard       from './JobBoard.jsx';
import AIChat         from './AIChat.jsx';

// ── Metric card ───────────────────────────────────────────────────────────────

function MetricCard({ icon, label, value, sub, accent }) {
  const accents = {
    blue:   { ring: 'ring-blue-100',   iconBg: 'bg-blue-50',   iconText: 'text-blue-500'   },
    green:  { ring: 'ring-green-100',  iconBg: 'bg-green-50',  iconText: 'text-green-500'  },
    red:    { ring: 'ring-red-100',    iconBg: 'bg-red-50',    iconText: 'text-red-500'    },
    purple: { ring: 'ring-purple-100', iconBg: 'bg-purple-50', iconText: 'text-purple-500' },
    gray:   { ring: 'ring-gray-100',   iconBg: 'bg-gray-50',   iconText: 'text-gray-400'   },
  };
  const a = accents[accent] ?? accents.gray;

  return (
    <div className={`card p-4 ring-1 ${a.ring}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg flex-shrink-0 ${a.iconBg} ${a.iconText}`}>
          {icon}
        </div>
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1,2,3,4].map(i => <Skeleton key={i} className="h-24" />)}
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
  const [snapshot,    setSnapshot]    = useState({ jobs: [], assignments: [], subSchedules: [] });
  const [conflicts,   setConflicts]   = useState([]);
  const [crewList,    setCrewList]    = useState([]);
  const [client,      setClient]      = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [chatOpen,    setChatOpen]    = useState(false);
  const [prefill,     setPrefill]     = useState('');

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

  function handleChatClose() {
    setChatOpen(false);
    setPrefill('');
  }

  // ── Derived metrics ─────────────────────────────────────────────────────────
  const today    = new Date().toISOString().split('T')[0];
  const nextWeek = new Date(Date.now() + 7 * 86_400_000).toISOString().split('T')[0];

  const activeJobs   = snapshot.jobs.filter(j => j.status === 'active').length;
  const crewOnSite   = crewList.filter(c => c.status === 'on_site').length;
  const subsThisWeek = snapshot.subSchedules.filter(
    s => s.scheduled_date >= today && s.scheduled_date <= nextWeek
  ).length;

  const metrics = [
    {
      icon:   '🏗️',
      label:  'Active Jobs',
      value:  activeJobs,
      sub:    `${snapshot.jobs.filter(j => j.status === 'paused').length} paused`,
      accent: 'blue',
    },
    {
      icon:   '👷',
      label:  'Crew On Site',
      value:  crewOnSite,
      sub:    `${crewList.length} total crew`,
      accent: crewOnSite > 0 ? 'green' : 'gray',
    },
    {
      icon:   '⚠️',
      label:  'Conflicts',
      value:  conflicts.length,
      sub:    conflicts.length > 0 ? 'Needs attention' : 'All clear',
      accent: conflicts.length > 0 ? 'red' : 'green',
    },
    {
      icon:   '📅',
      label:  'Subs This Week',
      value:  subsThisWeek,
      sub:    'scheduled visits',
      accent: 'purple',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar companyName={client?.company_name} />

      {loading ? (
        <DashboardSkeleton />
      ) : error ? (
        <div className="max-w-7xl mx-auto px-4 py-12 text-center">
          <p className="text-red-600 text-sm">{error}</p>
          <button onClick={fetchAll} className="btn-primary mt-4">Retry</button>
        </div>
      ) : (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          {/* Greeting */}
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              Good {getTimeOfDay()}, {client?.owner_name?.split(' ')[0] ?? 'there'}
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
          </div>

          {/* Metric cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {metrics.map(m => <MetricCard key={m.label} {...m} />)}
          </div>

          {/* Conflict alerts */}
          <ConflictAlerts
            conflicts={conflicts}
            onResolve={handleResolve}
            onAskAI={handleAskAI}
          />

          {/* Gantt + Crew side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <GanttChart jobs={snapshot.jobs} conflicts={conflicts} />
            </div>
            <div>
              <CrewPanel
                crew={crewList}
                assignments={snapshot.assignments}
                onRefresh={fetchAll}
              />
            </div>
          </div>

          {/* Job board */}
          <JobBoard jobs={snapshot.jobs} />
        </main>
      )}

      {/* Floating AI chat button */}
      <button
        onClick={() => setChatOpen(true)}
        className={`
          fixed bottom-6 right-6 z-40
          w-14 h-14 rounded-full
          bg-brand-500 hover:bg-brand-600 active:bg-brand-700
          shadow-lg hover:shadow-xl
          text-white text-xl
          flex items-center justify-center
          transition-all duration-200
          ${chatOpen ? 'scale-0 opacity-0' : 'scale-100 opacity-100'}
        `}
        aria-label="Open AI assistant"
      >
        🤖
      </button>

      {/* AI Chat panel */}
      <AIChat
        isOpen={chatOpen}
        onClose={handleChatClose}
        prefillMessage={prefill}
      />
    </div>
  );
}

function getTimeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}
