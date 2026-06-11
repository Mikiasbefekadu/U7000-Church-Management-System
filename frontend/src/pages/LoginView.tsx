/**
 * LoginView.tsx
 *
 * Full-page login screen.
 *
 * Visual design mirrors the `.login-wrap / .login-card` section in
 * church_management_system_ui.html:
 *   - Sidebar-blue (#1E3A5F) background wrapper
 *   - White card, 340 px wide, 14 px radius
 *   - Gold star icon inside a sidebar-coloured rounded square
 *   - Fraunces serif for the church name heading
 *   - DM Sans (font-sans) for all form text
 *
 * Auth flow:
 *   POST /auth/login  →  { token, userId, username, role, assignedZoneId, assignedKcuId }
 *   On success        →  login(profile) from AuthContext
 *   On 401 / network  →  inline error banner (never throws to the console)
 *
 * The component is intentionally self-contained — no router dependency —
 * so it can be mounted anywhere in the tree while routing is wired up later.
 */

import { useState, type FormEvent } from 'react';
import axios, { type AxiosError } from 'axios';
import { useAuth, type StoredAuthProfile } from '../context/AuthContext';
import api from '../services/api';
import churchLogo from '../assets/7000.PNG';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LoginRequest {
  username: string;
  password: string;
}

/** Shape of a backend error body (Spring default error handler). */
interface ApiErrorBody {
  status?: number;
  error?: string;
  message?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract a human-readable message from an Axios error. */
function extractErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const axiosErr = err as AxiosError<ApiErrorBody>;

    // Network / timeout — backend not reachable
    if (!axiosErr.response) {
      return 'Cannot reach the server. Make sure the backend is running on port 8080.';
    }

    const { status, data } = axiosErr.response;

    if (status === 401) {
      return data?.message ?? 'Invalid username or password.';
    }
    if (status === 400) {
      return data?.message ?? 'Please fill in all required fields.';
    }
    if (status === 403) {
      return 'Access denied. Your account does not have permission to log in here.';
    }
    if (status && status >= 500) {
      return 'A server error occurred. Please try again later.';
    }

    return data?.message ?? `Unexpected error (${status}).`;
  }

  if (err instanceof Error) return err.message;
  return 'An unexpected error occurred.';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function LoginView() {
  const { login } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [showPw,   setShowPw]   = useState(false);

  // ── Submit handler ─────────────────────────────────────────────────────────

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;

    // Basic client-side guard
    if (!username.trim() || !password.trim()) {
      setError('Username and password are required.');
      return;
    }

    setLoading(true);
    setError(null);

    const body: LoginRequest = { username: username.trim(), password };

    try {
      // POST /auth/login — note: no Authorization header needed (public endpoint)
      const response = await api.post<StoredAuthProfile>('/api/auth/login', body);
      const profile  = response.data;

      // Hand the full profile to AuthContext — it persists the token and
      // updates role / scope state for the rest of the app.
      login(profile);

      // Navigation is intentionally left to the parent (App.tsx) which
      // watches isAuthenticated and swaps the view accordingly.
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    /* Full-page wrapper — sidebar blue background, centred card */
    <div className="min-h-screen bg-sidebar flex items-center justify-center p-4">
      <div
        className="bg-white rounded-[14px] border border-gray-200/60 shadow-xl w-full max-w-[340px] px-8 py-9"
        role="main"
      >
        {/* ── Logo block ── */}
        <div className="flex flex-col items-center mb-6">
          <img
            src={churchLogo}
            alt="Gospel Believers Unique 7000 Church"
            className="w-16 h-16 rounded-full object-cover mb-2.5"
          />

          {/* Fraunces serif for the church name */}
          <h1 className="font-serif text-xl font-normal text-gray-800 leading-tight text-center">
            Gospel Believers Unique 7000 Church
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">Management System</p>
        </div>

        {/* ── Section label ── */}
        <p className="text-[11px] text-gray-400 text-center mb-5 uppercase tracking-widest">
          Sign in to your account
        </p>

        {/* ── Error banner ── */}
        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 bg-danger-light border border-danger/20 text-danger rounded-lg px-3 py-2.5 mb-4 text-[12px] leading-snug"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              className="w-4 h-4 shrink-0 mt-px"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* ── Form ── */}
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {/* Username */}
          <div>
            <label
              htmlFor="login-username"
              className="block text-xs text-gray-500 mb-1.5"
            >
              Username
            </label>
            <input
              id="login-username"
              type="text"
              autoComplete="username"
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
              placeholder="e.g. admin"
              className="w-full border border-gray-200 rounded-md px-3 py-2 text-[13px] text-gray-800 bg-white placeholder-gray-300 focus:outline-none focus:border-primary transition-colors disabled:opacity-60"
            />
          </div>

          {/* Password */}
          <div>
            <label
              htmlFor="login-password"
              className="block text-xs text-gray-500 mb-1.5"
            >
              Password
            </label>
            <div className="relative">
              <input
                id="login-password"
                type={showPw ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                placeholder="••••••••"
                className="w-full border border-gray-200 rounded-md px-3 py-2 pr-9 text-[13px] text-gray-800 bg-white placeholder-gray-300 focus:outline-none focus:border-primary transition-colors disabled:opacity-60"
              />
              {/* Show / hide toggle */}
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                aria-label={showPw ? 'Hide password' : 'Show password'}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                {showPw ? (
                  /* Eye-off */
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  /* Eye */
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-sidebar text-white rounded-lg py-2.5 text-sm font-medium font-sans hover:bg-sidebar-hover active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed mt-1 cursor-pointer"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                {/* Spinner */}
                <svg
                  className="w-4 h-4 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  aria-hidden="true"
                >
                  <path
                    d="M12 2a10 10 0 0 1 10 10"
                    strokeLinecap="round"
                  />
                </svg>
                Signing In…
              </span>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        {/* ── Footer note ── */}
        <p className="text-[10px] text-gray-300 text-center mt-6 leading-relaxed">
          Access is restricted to authorised church leaders.
          <br />
          Contact your administrator if you need an account.
        </p>
      </div>
    </div>
  );
}
