import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';

const T = {
  black:    '#0a0a0a',
  dark:     '#161616',
  mid:      '#222222',
  border:   '#2a2a2a',
  borderLt: '#333333',
  accent:   '#47c8ff',
  text:     '#e8e6e0',
  textSec:  '#999690',
  dim:      '#888888',
};
const syne   = { fontFamily: 'Syne, sans-serif' };
const dmSans = { fontFamily: 'DM Sans, sans-serif' };

export default function Login() {
  const navigate = useNavigate();
  const [form,    setForm]    = useState({ email: '', password: '' });
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email:    form.email.trim().toLowerCase(),
      password: form.password,
    });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      navigate('/dashboard');
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: T.black, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: '40px 16px',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Subtle grid */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: `linear-gradient(${T.border} 1px, transparent 1px), linear-gradient(90deg, ${T.border} 1px, transparent 1px)`,
        backgroundSize: '48px 48px', opacity: 0.2,
      }} />
      {/* Glow */}
      <div style={{
        position: 'absolute', top: '25%', left: '50%', transform: 'translate(-50%,-50%)',
        width: 500, height: 400, borderRadius: '50%',
        background: 'radial-gradient(ellipse at center, rgba(71,200,255,0.06) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 400 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <Link to="/" style={{ textDecoration: 'none', display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: 'linear-gradient(135deg,#47c8ff,#6366f1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="20" height="20" viewBox="0 0 14 14" fill="none">
                <rect x="0" y="0" width="5" height="5" rx="1" fill="#0d0d0d"/>
                <rect x="9" y="0" width="5" height="5" rx="1" fill="#0d0d0d"/>
                <rect x="0" y="9" width="14" height="5" rx="1" fill="#0d0d0d"/>
              </svg>
            </div>
            <span style={{ ...syne, fontWeight: 800, fontSize: 22, color: T.text, letterSpacing: '-0.02em' }}>
              Schedule<span style={{ color: T.accent }}>AI</span>
            </span>
          </Link>
          <p style={{ ...dmSans, fontSize: 13, color: T.dim, marginTop: 6, fontWeight: 300 }}>
            AI-powered scheduling for contractors
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: T.dark, border: `1px solid ${T.border}`, borderRadius: 16,
          padding: '36px 32px',
        }}>
          <h2 style={{ ...syne, fontWeight: 700, fontSize: 16, color: T.text, margin: '0 0 24px' }}>
            Sign in to your account
          </h2>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label htmlFor="email" style={{ ...dmSans, fontSize: 12, fontWeight: 500, color: T.textSec, display: 'block', marginBottom: 6, letterSpacing: '0.03em' }}>
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={form.email}
                onChange={set('email')}
                placeholder="you@yourcompany.com"
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: T.mid, border: `1px solid ${T.border}`, borderRadius: 8,
                  padding: '11px 14px', ...dmSans, fontSize: 14, color: T.text,
                  outline: 'none', transition: 'border-color 0.2s',
                }}
                onFocus={e => e.target.style.borderColor = T.accent}
                onBlur={e => e.target.style.borderColor = T.border}
              />
            </div>

            <div>
              <label htmlFor="password" style={{ ...dmSans, fontSize: 12, fontWeight: 500, color: T.textSec, display: 'block', marginBottom: 6, letterSpacing: '0.03em' }}>
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={form.password}
                onChange={set('password')}
                placeholder="••••••••"
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: T.mid, border: `1px solid ${T.border}`, borderRadius: 8,
                  padding: '11px 14px', ...dmSans, fontSize: 14, color: T.text,
                  outline: 'none', transition: 'border-color 0.2s',
                }}
                onFocus={e => e.target.style.borderColor = T.accent}
                onBlur={e => e.target.style.borderColor = T.border}
              />
            </div>

            {error && (
              <div style={{
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
                borderRadius: 8, padding: '10px 14px',
              }}>
                <p style={{ ...dmSans, fontSize: 13, color: '#f87171', margin: 0 }}>{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', marginTop: 4,
                background: loading ? T.border : T.accent,
                color: T.black, border: 'none', borderRadius: 8,
                padding: '12px 20px', ...syne, fontSize: 14, fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'opacity 0.2s', opacity: loading ? 0.6 : 1,
              }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.opacity = '0.85'; }}
              onMouseLeave={e => { e.currentTarget.style.opacity = loading ? '0.6' : '1'; }}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p style={{ ...dmSans, fontSize: 13, color: T.dim, textAlign: 'center', marginTop: 24 }}>
            New here?{' '}
            <Link to="/onboarding" style={{ color: T.accent, fontWeight: 500, textDecoration: 'none' }}
              onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
              onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}>
              Start your free trial
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
