import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth }  from '../App.jsx';

export default function Navbar({ companyName }) {
  const location = useLocation();
  const { session } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  const email = session?.user?.email ?? '';

  async function handleSignOut() {
    setSigningOut(true);
    await supabase.auth.signOut();
  }

  const navLink = (to, label) => (
    <Link
      to={to}
      className={`px-3 py-2 rounded-md text-sm font-medium transition-colors
        ${location.pathname === to
          ? 'bg-brand-50 text-brand-600'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        }`}
    >
      {label}
    </Link>
  );

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Brand */}
          <div className="flex items-center gap-6">
            <Link to="/dashboard" className="flex items-center gap-2">
              <span className="text-xl">🏗️</span>
              <span className="font-bold text-gray-900 text-lg">
                Schedule<span className="text-brand-500">AI</span>
              </span>
            </Link>
            <div className="hidden sm:flex items-center gap-1">
              {navLink('/dashboard', 'Dashboard')}
              {navLink('/settings',  'Settings')}
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {companyName && (
              <span className="hidden md:block text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                {companyName}
              </span>
            )}
            <span className="hidden sm:block text-sm text-gray-400">{email}</span>
            <button
              onClick={handleSignOut}
              disabled={signingOut}
              className="btn-secondary text-xs py-1.5 px-3"
            >
              {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
