import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';

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
    <div className="min-h-screen bg-paper flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,#47c8ff,#6366f1)' }}>
            <svg width="22" height="22" viewBox="0 0 14 14" fill="none">
              <rect x="0" y="0" width="5" height="5" rx="1" fill="#0d0d0d"/>
              <rect x="9" y="0" width="5" height="5" rx="1" fill="#0d0d0d"/>
              <rect x="0" y="9" width="14" height="5" rx="1" fill="#0d0d0d"/>
            </svg>
          </div>
        </div>
        <h1 className="text-center text-3xl font-display italic text-ink"
          style={{ fontFamily: 'Instrument Serif, Georgia, serif' }}>
          ScheduleAI
        </h1>
        <p className="mt-1 text-center text-sm text-muted">
          AI-powered scheduling for contractors
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="card px-8 py-8">
          <h2 className="text-base font-semibold text-ink mb-6">Sign in to your account</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="label">Email address</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={form.email}
                onChange={set('email')}
                className="input"
                placeholder="you@yourcompany.com"
              />
            </div>
            <div>
              <label htmlFor="password" className="label">Password</label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={form.password}
                onChange={set('password')}
                className="input"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-muted">
            New here?{' '}
            <Link to="/onboarding" className="font-medium text-brand-500 hover:text-brand-600">
              Start your free trial
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
