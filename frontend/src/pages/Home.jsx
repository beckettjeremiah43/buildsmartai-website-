import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

// ── Design tokens ─────────────────────────────────────────────────────────────
const T = {
  black:    '#0a0a0a',
  offBlack: '#111111',
  dark:     '#161616',
  mid:      '#222222',
  border:   '#2a2a2a',
  borderLt: '#333333',
  accent:   '#47c8ff',
  accentDim:'rgba(71,200,255,0.12)',
  text:     '#e8e6e0',
  textSec:  '#999690',
  dim:      '#888888',
};

const syne    = { fontFamily: 'Syne, sans-serif' };
const dmSans  = { fontFamily: 'DM Sans, sans-serif' };

// ── Reusable primitives ───────────────────────────────────────────────────────

function Pill({ children }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      background: T.accentDim, border: `1px solid rgba(71,200,255,0.25)`,
      color: T.accent, borderRadius: 999, padding: '4px 14px',
      fontSize: 11, fontWeight: 600, letterSpacing: '0.08em',
      textTransform: 'uppercase', ...syne,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: T.accent, flexShrink: 0 }} />
      {children}
    </span>
  );
}

// ── Marquee strip ─────────────────────────────────────────────────────────────

const MARQUEE_ITEMS = [
  'Conflict Detection', 'Crew Scheduling', 'AI-Powered', 'Sub Contractor Tracking',
  'Real-Time Gantt', 'Job Board', 'Smart Alerts', 'Client Reports',
];

function MarqueeStrip() {
  const items = [...MARQUEE_ITEMS, ...MARQUEE_ITEMS];
  return (
    <div style={{
      background: T.dark, borderTop: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}`,
      overflow: 'hidden', padding: '14px 0',
    }}>
      <style>{`
        @keyframes marquee { 0% { transform: translateX(0) } 100% { transform: translateX(-50%) } }
        .marquee-inner { display: flex; gap: 40px; animation: marquee 28s linear infinite; width: max-content; }
        .marquee-inner:hover { animation-play-state: paused; }
      `}</style>
      <div className="marquee-inner">
        {items.map((item, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, whiteSpace: 'nowrap', ...dmSans }}>
            <span style={{ color: T.accent, fontSize: 10 }}>◆</span>
            <span style={{ color: T.textSec, fontSize: 13, fontWeight: 400, letterSpacing: '0.04em' }}>{item}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Nav ───────────────────────────────────────────────────────────────────────

function Nav() {
  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 100,
      background: 'rgba(10,10,10,0.85)', backdropFilter: 'blur(20px)',
      borderBottom: `1px solid ${T.border}`,
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8, flexShrink: 0,
            background: 'linear-gradient(135deg,#47c8ff,#6366f1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
              <rect x="0" y="0" width="5" height="5" rx="1" fill="#0d0d0d"/>
              <rect x="9" y="0" width="5" height="5" rx="1" fill="#0d0d0d"/>
              <rect x="0" y="9" width="14" height="5" rx="1" fill="#0d0d0d"/>
            </svg>
          </div>
          <span style={{ ...syne, fontWeight: 700, fontSize: 15, color: T.text }}>
            Schedule<span style={{ color: T.accent }}>AI</span>
          </span>
        </div>

        {/* Links */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Link to="/login" style={{ ...dmSans, fontSize: 13, color: T.textSec, padding: '8px 16px', textDecoration: 'none', transition: 'color 0.2s' }}
            onMouseEnter={e => e.currentTarget.style.color = T.text}
            onMouseLeave={e => e.currentTarget.style.color = T.textSec}>
            Sign in
          </Link>
          <Link to="/onboarding" style={{
            ...dmSans, fontSize: 13, fontWeight: 500, color: T.black,
            background: T.accent, padding: '8px 20px', borderRadius: 8,
            textDecoration: 'none', transition: 'opacity 0.2s',
          }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
            Start free trial
          </Link>
        </div>
      </div>
    </nav>
  );
}

// ── Hero ──────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section style={{
      minHeight: '92vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative', overflow: 'hidden',
      background: T.black,
    }}>
      {/* Grid background */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: `linear-gradient(${T.border} 1px, transparent 1px), linear-gradient(90deg, ${T.border} 1px, transparent 1px)`,
        backgroundSize: '48px 48px', opacity: 0.35,
      }} />
      {/* Radial glow */}
      <div style={{
        position: 'absolute', top: '30%', left: '50%', transform: 'translate(-50%,-50%)',
        width: 700, height: 500, borderRadius: '50%',
        background: 'radial-gradient(ellipse at center, rgba(71,200,255,0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', padding: '80px 32px', maxWidth: 900, margin: '0 auto' }}>
        <style>{`
          @keyframes fadeUp { from { opacity:0; transform:translateY(24px) } to { opacity:1; transform:translateY(0) } }
          .hero-pill  { animation: fadeUp 0.6s ease both; animation-delay: 0.1s; }
          .hero-h1    { animation: fadeUp 0.6s ease both; animation-delay: 0.25s; }
          .hero-sub   { animation: fadeUp 0.6s ease both; animation-delay: 0.4s; }
          .hero-ctas  { animation: fadeUp 0.6s ease both; animation-delay: 0.55s; }
        `}</style>

        <div className="hero-pill" style={{ marginBottom: 28 }}>
          <Pill>AI-Powered Contractor Scheduling</Pill>
        </div>

        <h1 className="hero-h1" style={{
          ...syne, fontWeight: 800, fontSize: 'clamp(42px, 7vw, 80px)',
          color: T.text, lineHeight: 1.05, letterSpacing: '-0.03em',
          marginBottom: 24,
        }}>
          Stop losing jobs to<br />
          <span style={{ color: T.accent }}>scheduling chaos.</span>
        </h1>

        <p className="hero-sub" style={{
          ...dmSans, fontSize: 'clamp(15px, 2vw, 18px)', color: T.textSec,
          lineHeight: 1.7, maxWidth: 560, margin: '0 auto 40px', fontWeight: 300,
        }}>
          ScheduleAI gives contractors a real-time view of every crew, job, and sub — with AI that spots conflicts before they cost you money.
        </p>

        <div className="hero-ctas" style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/onboarding" style={{
            ...dmSans, fontWeight: 500, fontSize: 14, color: T.black,
            background: T.accent, padding: '14px 32px', borderRadius: 10,
            textDecoration: 'none', transition: 'all 0.2s', display: 'inline-flex', alignItems: 'center', gap: 8,
          }}
            onMouseEnter={e => { e.currentTarget.style.opacity = '0.85'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1';    e.currentTarget.style.transform = 'translateY(0)'; }}>
            Start free trial
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"/></svg>
          </Link>
          <Link to="/login" style={{
            ...dmSans, fontWeight: 400, fontSize: 14, color: T.textSec,
            background: 'transparent', border: `1px solid ${T.border}`,
            padding: '14px 32px', borderRadius: 10,
            textDecoration: 'none', transition: 'all 0.2s', display: 'inline-flex', alignItems: 'center', gap: 8,
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = T.borderLt; e.currentTarget.style.color = T.text; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = T.border;   e.currentTarget.style.color = T.textSec; }}>
            Sign in
          </Link>
        </div>

        {/* Social proof */}
        <p style={{ ...dmSans, fontSize: 12, color: T.dim, marginTop: 40 }}>
          No credit card required · Free 14-day trial
        </p>
      </div>
    </section>
  );
}

// ── Problem strip ─────────────────────────────────────────────────────────────

function ProblemStrip() {
  const problems = [
    { icon: '📋', text: 'Double-booked crews' },
    { icon: '📞', text: 'Missed sub confirmations' },
    { icon: '💸', text: 'Costly job delays' },
    { icon: '📊', text: 'No real-time visibility' },
  ];
  return (
    <section style={{ background: T.offBlack, borderTop: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}`, padding: '60px 32px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', textAlign: 'center' }}>
        <p style={{ ...dmSans, fontSize: 12, fontWeight: 500, color: T.dim, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 40 }}>
          Sound familiar?
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 24 }}>
          {problems.map(({ icon, text }) => (
            <div key={text} style={{
              background: T.dark, border: `1px solid ${T.border}`, borderRadius: 12,
              padding: '24px 20px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>{icon}</div>
              <p style={{ ...dmSans, fontSize: 14, color: T.textSec, fontWeight: 300 }}>{text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Features ──────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: '🤖',
    title: 'AI Scheduling Assistant',
    desc: 'Ask plain-English questions about your schedule. "Who\'s free Thursday?" or "Any conflicts this week?" — get instant answers.',
  },
  {
    icon: '⚡',
    title: 'Conflict Detection',
    desc: 'Automatic alerts when crew members are double-booked or subs are scheduled during job downtime. Fix it before it\'s a problem.',
  },
  {
    icon: '📅',
    title: 'Real-Time Gantt',
    desc: 'Visual timeline of every job and assignment. See your whole operation at a glance — no spreadsheet required.',
  },
  {
    icon: '👷',
    title: 'Crew Management',
    desc: 'Track on-site status, skill sets, and availability for your entire crew. Assign the right people to the right jobs.',
  },
  {
    icon: '🏗️',
    title: 'Sub Contractor Tracking',
    desc: 'Schedule sub visits, track confirmations, and get alerts when subs haven\'t confirmed. Keep every trade on time.',
  },
  {
    icon: '📊',
    title: 'Job Board',
    desc: 'Kanban-style job board with status cards for active, paused, and completed projects. Drag to update at a glance.',
  },
];

function Features() {
  return (
    <section style={{ background: T.black, padding: '100px 32px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <div style={{ marginBottom: 16 }}><Pill>Features</Pill></div>
          <h2 style={{ ...syne, fontWeight: 800, fontSize: 'clamp(28px, 4vw, 48px)', color: T.text, letterSpacing: '-0.02em', margin: 0 }}>
            Everything you need to run<br />a tighter job site.
          </h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
          {FEATURES.map(({ icon, title, desc }) => (
            <div key={title} style={{
              background: T.dark, border: `1px solid ${T.border}`, borderRadius: 16,
              padding: '28px 24px', transition: 'border-color 0.2s',
            }}
              onMouseEnter={e => e.currentTarget.style.borderColor = T.borderLt}
              onMouseLeave={e => e.currentTarget.style.borderColor = T.border}>
              <div style={{ fontSize: 28, marginBottom: 14 }}>{icon}</div>
              <h3 style={{ ...syne, fontWeight: 700, fontSize: 16, color: T.text, margin: '0 0 8px' }}>{title}</h3>
              <p style={{ ...dmSans, fontSize: 14, color: T.textSec, lineHeight: 1.65, fontWeight: 300, margin: 0 }}>{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Product showcase ──────────────────────────────────────────────────────────

function ProductShowcase() {
  return (
    <section style={{ background: T.offBlack, borderTop: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}`, padding: '100px 32px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center' }}>
        <div>
          <div style={{ marginBottom: 20 }}><Pill>The Dashboard</Pill></div>
          <h2 style={{ ...syne, fontWeight: 800, fontSize: 'clamp(26px, 3.5vw, 42px)', color: T.text, letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: 20 }}>
            Your whole operation,<br />
            <span style={{ color: T.accent }}>at a glance.</span>
          </h2>
          <p style={{ ...dmSans, fontSize: 15, color: T.textSec, lineHeight: 1.7, fontWeight: 300, marginBottom: 32 }}>
            From live crew status and conflict alerts to the AI assistant that knows your schedule — everything is one click away. No tab-switching, no spreadsheet hunting.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              'Live conflict detection with one-click resolution',
              'AI assistant that knows your entire schedule',
              'Crew status, assignments, and availability',
              'Visual Gantt timeline for every active job',
            ].map(item => (
              <div key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span style={{ color: T.accent, fontSize: 14, marginTop: 1, flexShrink: 0 }}>✓</span>
                <span style={{ ...dmSans, fontSize: 14, color: T.textSec, fontWeight: 300 }}>{item}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 36 }}>
            <Link to="/onboarding" style={{
              ...dmSans, fontWeight: 500, fontSize: 14, color: T.black,
              background: T.accent, padding: '12px 28px', borderRadius: 8,
              textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8,
              transition: 'opacity 0.2s',
            }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
              See it in action
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"/></svg>
            </Link>
          </div>
        </div>

        {/* Dashboard mockup */}
        <div style={{
          background: T.dark, border: `1px solid ${T.border}`, borderRadius: 16, overflow: 'hidden',
          boxShadow: '0 40px 80px rgba(0,0,0,0.6)',
        }}>
          {/* Window chrome */}
          <div style={{ background: '#0d0d0d', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 6, borderBottom: `1px solid ${T.border}` }}>
            {['#ef4444','#f59e0b','#22c55e'].map(c => (
              <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />
            ))}
            <div style={{ flex: 1, margin: '0 12px', background: T.mid, borderRadius: 4, height: 20, display: 'flex', alignItems: 'center', padding: '0 8px' }}>
              <span style={{ fontSize: 10, color: T.dim, ...dmSans }}>app.scheduleai.com/dashboard</span>
            </div>
          </div>
          {/* Mock content */}
          <div style={{ padding: 20 }}>
            {/* Metric row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
              {[['📋','4','Active Jobs'],['👷','6','On Site'],['⚠','1','Conflicts'],['📅','8','This Week']].map(([ic, val, lb]) => (
                <div key={lb} style={{ background: T.mid, borderRadius: 8, padding: '10px 10px', borderTop: `2px solid ${T.accent}` }}>
                  <p style={{ fontSize: 8, color: T.dim, ...dmSans, marginBottom: 4 }}>{lb}</p>
                  <p style={{ fontSize: 18, color: T.text, ...syne, fontWeight: 700 }}>{val}</p>
                </div>
              ))}
            </div>
            {/* Conflict alert */}
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '10px 12px', marginBottom: 12 }}>
              <p style={{ fontSize: 10, color: '#ef4444', ...syne, fontWeight: 600 }}>⚠ Conflict — Crew double-booked Jan 15</p>
            </div>
            {/* Job rows */}
            {[['Kitchen Remodel','On track','#22c55e'],['Office Build-out','⚠ Conflict','#ef4444'],['Deck Addition','On track','#22c55e']].map(([name, status, col]) => (
              <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: `1px solid ${T.border}` }}>
                <div style={{ width: 2, height: 24, borderRadius: 2, background: col, flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 11, color: T.text, ...dmSans }}>{name}</span>
                <span style={{ fontSize: 9, color: col, fontWeight: 600, ...syne }}>{status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ── How it works ──────────────────────────────────────────────────────────────

const STEPS = [
  { num: '01', title: 'Set up your crew & jobs', desc: 'Add your team members, skill sets, and active job sites in minutes.' },
  { num: '02', title: 'Schedule assignments', desc: 'Assign crew and subs to jobs. The system auto-detects any conflicts.' },
  { num: '03', title: 'Get alerted instantly', desc: 'Conflicts, overdue confirmations, and crew changes surface in real time.' },
  { num: '04', title: 'Ask the AI anything', desc: 'Chat with your scheduling assistant for answers, summaries, and documents.' },
];

function HowItWorks() {
  return (
    <section style={{ background: T.black, padding: '100px 32px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ marginBottom: 16 }}><Pill>How it works</Pill></div>
        <h2 style={{ ...syne, fontWeight: 800, fontSize: 'clamp(26px, 4vw, 44px)', color: T.text, letterSpacing: '-0.02em', marginBottom: 60 }}>
          Up and running in an afternoon.
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 1, background: T.border, borderRadius: 16, overflow: 'hidden', border: `1px solid ${T.border}` }}>
          {STEPS.map(({ num, title, desc }) => (
            <div key={num} style={{ background: T.dark, padding: '36px 28px', textAlign: 'left' }}>
              <p style={{ ...syne, fontSize: 40, fontWeight: 800, color: T.accentDim, margin: '0 0 16px', lineHeight: 1, color: 'rgba(71,200,255,0.2)' }}>{num}</p>
              <h3 style={{ ...syne, fontWeight: 700, fontSize: 15, color: T.text, margin: '0 0 10px' }}>{title}</h3>
              <p style={{ ...dmSans, fontSize: 13, color: T.textSec, lineHeight: 1.65, fontWeight: 300, margin: 0 }}>{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── CTA ───────────────────────────────────────────────────────────────────────

function CTA() {
  return (
    <section style={{ background: T.offBlack, borderTop: `1px solid ${T.border}`, padding: '100px 32px' }}>
      <div style={{
        maxWidth: 680, margin: '0 auto', textAlign: 'center',
        position: 'relative',
      }}>
        <div style={{ marginBottom: 24 }}><Pill>Get started today</Pill></div>
        <h2 style={{ ...syne, fontWeight: 800, fontSize: 'clamp(30px, 5vw, 56px)', color: T.text, letterSpacing: '-0.02em', lineHeight: 1.05, marginBottom: 20 }}>
          Take control of your schedule.
        </h2>
        <p style={{ ...dmSans, fontSize: 16, color: T.textSec, fontWeight: 300, lineHeight: 1.7, marginBottom: 40 }}>
          Join contractors who use ScheduleAI to prevent conflicts, coordinate crews, and keep every job on track — with AI that works for you 24/7.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/onboarding" style={{
            ...dmSans, fontWeight: 500, fontSize: 15, color: T.black,
            background: T.accent, padding: '16px 40px', borderRadius: 10,
            textDecoration: 'none', transition: 'all 0.2s', display: 'inline-flex', alignItems: 'center', gap: 8,
          }}
            onMouseEnter={e => { e.currentTarget.style.opacity = '0.85'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1';    e.currentTarget.style.transform = 'translateY(0)'; }}>
            Start free trial
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"/></svg>
          </Link>
          <Link to="/login" style={{
            ...dmSans, fontWeight: 400, fontSize: 15, color: T.textSec,
            background: 'transparent', border: `1px solid ${T.border}`,
            padding: '16px 40px', borderRadius: 10,
            textDecoration: 'none', transition: 'all 0.2s',
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = T.borderLt; e.currentTarget.style.color = T.text; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = T.border;   e.currentTarget.style.color = T.textSec; }}>
            Sign in
          </Link>
        </div>
        <p style={{ ...dmSans, fontSize: 12, color: T.dim, marginTop: 24 }}>
          No credit card required · 14-day free trial · Cancel anytime
        </p>
      </div>
    </section>
  );
}

// ── Footer ────────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer style={{ background: T.black, borderTop: `1px solid ${T.border}`, padding: '40px 32px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 22, height: 22, borderRadius: 6,
            background: 'linear-gradient(135deg,#47c8ff,#6366f1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <svg width="10" height="10" viewBox="0 0 14 14" fill="none">
              <rect x="0" y="0" width="5" height="5" rx="1" fill="#0d0d0d"/>
              <rect x="9" y="0" width="5" height="5" rx="1" fill="#0d0d0d"/>
              <rect x="0" y="9" width="14" height="5" rx="1" fill="#0d0d0d"/>
            </svg>
          </div>
          <span style={{ ...syne, fontWeight: 700, fontSize: 13, color: T.textSec }}>
            Schedule<span style={{ color: T.accent }}>AI</span>
          </span>
        </div>
        <p style={{ ...dmSans, fontSize: 12, color: T.dim, margin: 0 }}>
          © {new Date().getFullYear()} ScheduleAI. Built for contractors.
        </p>
        <div style={{ display: 'flex', gap: 20 }}>
          {[['Sign in', '/login'], ['Start trial', '/onboarding']].map(([label, to]) => (
            <Link key={to} to={to} style={{ ...dmSans, fontSize: 12, color: T.dim, textDecoration: 'none', transition: 'color 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.color = T.textSec}
              onMouseLeave={e => e.currentTarget.style.color = T.dim}>
              {label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Home() {
  useEffect(() => {
    document.body.style.background = T.black;
    return () => { document.body.style.background = ''; };
  }, []);

  return (
    <div style={{ background: T.black, color: T.text, minHeight: '100vh' }}>
      <Nav />
      <Hero />
      <MarqueeStrip />
      <ProblemStrip />
      <Features />
      <ProductShowcase />
      <HowItWorks />
      <CTA />
      <Footer />
    </div>
  );
}
