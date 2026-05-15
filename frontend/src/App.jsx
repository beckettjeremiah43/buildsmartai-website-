import { createContext, useContext, useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes }        from 'react-router-dom';
import { supabase }    from './lib/supabase.js';
import Home            from './pages/Home.jsx';
import Login           from './pages/Login.jsx';
import Onboarding      from './pages/Onboarding.jsx';
import Dashboard       from './components/Dashboard.jsx';
import Settings        from './pages/Settings.jsx';
import Calendar        from './pages/Calendar.jsx';

// ── Auth context ──────────────────────────────────────────────────────────────

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

function AuthProvider({ children }) {
  const [session,  setSession]  = useState(undefined); // undefined = loading
  const [clientId, setClientId] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) setClientId(null);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ session, clientId, setClientId }}>
      {children}
    </AuthContext.Provider>
  );
}

// ── Route guards ──────────────────────────────────────────────────────────────

function RequireAuth({ children }) {
  const { session } = useAuth();
  if (session === undefined) return <LoadingScreen />;
  if (!session) return <Navigate to="/login" replace />;
  return children;
}

function RedirectIfAuthed({ children }) {
  const { session } = useAuth();
  if (session === undefined) return <LoadingScreen />;
  if (session) return <Navigate to="/dashboard" replace />;
  return children;
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-500">Loading...</p>
      </div>
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/"          element={<RedirectIfAuthed><Home /></RedirectIfAuthed>} />
          <Route path="/login"     element={<RedirectIfAuthed><Login /></RedirectIfAuthed>} />
          <Route path="/onboarding" element={<RedirectIfAuthed><Onboarding /></RedirectIfAuthed>} />
          <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
          <Route path="/calendar"  element={<RequireAuth><Calendar /></RequireAuth>} />
          <Route path="/settings"  element={<RequireAuth><Settings /></RequireAuth>} />
          <Route path="*"          element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
