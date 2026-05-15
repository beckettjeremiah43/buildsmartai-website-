import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth }  from '../App.jsx';

const NAV_ITEMS = [
  {
    to: '/dashboard',
    label: 'Dashboard',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1" y="1" width="6" height="6" rx="1.5" fill="currentColor"/>
        <rect x="9" y="1" width="6" height="6" rx="1.5" fill="currentColor"/>
        <rect x="1" y="9" width="6" height="6" rx="1.5" fill="currentColor"/>
        <rect x="9" y="9" width="6" height="6" rx="1.5" fill="currentColor"/>
      </svg>
    ),
  },
  {
    to: '/jobs',
    label: 'Jobs',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1" y="1" width="14" height="4" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
        <rect x="1" y="7" width="14" height="4" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
        <rect x="1" y="13" width="8" height="2" rx="1" fill="currentColor" opacity="0.5"/>
      </svg>
    ),
  },
  {
    to: '/contacts',
    label: 'Contacts',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="6" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M1 13c0-2.761 2.239-4 5-4s5 1.239 5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M12 7h3M13.5 5.5v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    to: '/contracts',
    label: 'Contracts',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="2" y="1" width="10" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M5 5h4M5 8h4M5 11h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M12 10l2 2-2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    to: '/calendar',
    label: 'Calendar',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1" y="2" width="14" height="13" rx="2" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M1 6h14" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M5 1v2M11 1v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <rect x="4" y="9" width="2" height="2" rx="0.5" fill="currentColor"/>
        <rect x="7" y="9" width="2" height="2" rx="0.5" fill="currentColor"/>
        <rect x="10" y="9" width="2" height="2" rx="0.5" fill="currentColor"/>
      </svg>
    ),
  },
  {
    to: '/settings',
    label: 'Settings',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41"
          stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
];

export default function Sidebar({ companyName, ownerName, onOpenAI, conflictCount = 0 }) {
  const location  = useLocation();
  const { session } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  const name     = ownerName ?? companyName ?? session?.user?.email ?? '';
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';

  async function handleSignOut() {
    setSigningOut(true);
    await supabase.auth.signOut();
  }

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside className="hidden lg:flex flex-col w-56 flex-shrink-0 min-h-screen sticky top-0 h-screen"
        style={{ background: '#0d0d0d' }}>

        {/* Logo */}
        <div className="px-5 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <Link to="/dashboard" className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg,#47c8ff,#6366f1)' }}>
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                <rect x="0" y="0" width="5" height="5" rx="1" fill="#0d0d0d"/>
                <rect x="9" y="0" width="5" height="5" rx="1" fill="#0d0d0d"/>
                <rect x="0" y="9" width="14" height="5" rx="1" fill="#0d0d0d"/>
              </svg>
            </div>
            <span className="text-sm font-semibold text-white tracking-tight">
              Schedule<span style={{ color: '#47c8ff' }}>AI</span>
            </span>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5">
          <p className="text-[9px] font-semibold tracking-widest uppercase px-2.5 mb-2"
            style={{ color: 'rgba(255,255,255,0.25)' }}>
            Main
          </p>

          {NAV_ITEMS.map(item => {
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className="flex items-center gap-2 py-2 rounded-lg text-sm transition-all"
                style={active ? {
                  paddingLeft: 'calc(0.625rem - 2px)',
                  paddingRight: '0.625rem',
                  background: 'linear-gradient(90deg,rgba(71,200,255,0.15),rgba(99,102,241,0.08))',
                  borderLeft: '2px solid #47c8ff',
                  color: '#47c8ff',
                  fontWeight: 500,
                } : {
                  paddingLeft: '0.625rem',
                  paddingRight: '0.625rem',
                  color: 'rgba(255,255,255,0.45)',
                }}
              >
                <span className="w-4 h-4 flex-shrink-0" style={{ opacity: active ? 1 : 0.4 }}>
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}

          {onOpenAI && (
            <button
              onClick={onOpenAI}
              className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm transition-all w-full text-left"
              style={{ color: 'rgba(255,255,255,0.45)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <span className="w-4 h-4 flex-shrink-0 opacity-40">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M8 1L10 6H15L11 9.5L12.5 15L8 12L3.5 15L5 9.5L1 6H6L8 1Z"
                    stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                </svg>
              </span>
              AI Assistant
              {conflictCount > 0 && (
                <span className="ml-auto w-4 h-4 rounded-full bg-red-500 text-[9px] font-bold text-white flex items-center justify-center">
                  {conflictCount}
                </span>
              )}
            </button>
          )}
        </nav>

        {/* User / sign out */}
        <div className="px-3 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all disabled:opacity-50"
            style={{ color: 'rgba(255,255,255,0.6)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold text-white flex-shrink-0"
              style={{ background: 'linear-gradient(135deg,#47c8ff,#a855f7)' }}>
              {initials}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-[13px] truncate" style={{ color: 'rgba(255,255,255,0.6)' }}>
                {companyName ?? session?.user?.email ?? ''}
              </p>
              <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
                {signingOut ? 'Signing out…' : 'Sign out'}
              </p>
            </div>
          </button>
        </div>
      </aside>

      {/* ── Mobile top bar ── */}
      <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-ink border-b border-rule sticky top-0 z-30">
        <Link to="/dashboard" className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,#47c8ff,#6366f1)' }}>
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
              <rect x="0" y="0" width="5" height="5" rx="1" fill="#0d0d0d"/>
              <rect x="9" y="0" width="5" height="5" rx="1" fill="#0d0d0d"/>
              <rect x="0" y="9" width="14" height="5" rx="1" fill="#0d0d0d"/>
            </svg>
          </div>
          <span className="text-sm font-semibold text-white">
            Schedule<span style={{ color: '#47c8ff' }}>AI</span>
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <Link to="/jobs"      className="text-white/50 hover:text-white text-xs px-2 py-1">Jobs</Link>
          <Link to="/contacts"  className="text-white/50 hover:text-white text-xs px-2 py-1">Contacts</Link>
          <Link to="/contracts" className="text-white/50 hover:text-white text-xs px-2 py-1">Contracts</Link>
          <Link to="/calendar" className="text-white/50 hover:text-white text-xs px-2 py-1">Calendar</Link>
          <Link to="/settings" className="text-white/50 hover:text-white text-xs px-2 py-1">Settings</Link>
          <button onClick={handleSignOut} disabled={signingOut}
            className="text-white/50 hover:text-white text-xs px-2 py-1 disabled:opacity-50">
            {signingOut ? '…' : 'Sign out'}
          </button>
        </div>
      </div>
    </>
  );
}
