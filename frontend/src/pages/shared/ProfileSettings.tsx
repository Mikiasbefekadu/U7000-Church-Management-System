/**
 * ProfileSettings.tsx
 *
 * Self-service profile management — accessible to all roles.
 *
 * Two independent sections:
 *   1. Display Name — update username/display name
 *   2. Change Password — requires current password verification
 *
 * Each section submits independently and shows its own inline
 * success/error feedback so users can update one without touching the other.
 */

import { useState, useEffect, type FormEvent } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getMyProfile, updateMyProfile, type ProfileResponse } from '../../services/userService';
import type { AxiosError } from 'axios';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractBackendError(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const axErr = err as AxiosError<{ error?: string; message?: string }>;
    return axErr.response?.data?.error
      ?? axErr.response?.data?.message
      ?? fallback;
  }
  return err instanceof Error ? err.message : fallback;
}

// ---------------------------------------------------------------------------
// Shared form atoms
// ---------------------------------------------------------------------------

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11.5px] font-medium text-gray-600 mb-1">{children}</p>
  );
}

function Input({
  type = 'text', value, onChange, placeholder, disabled,
}: {
  type?: string; value: string; onChange: (v: string) => void;
  placeholder?: string; disabled?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[12.5px] text-gray-800 bg-white placeholder-gray-300 focus:outline-none focus:border-primary transition-colors disabled:bg-gray-50 disabled:text-gray-400"
    />
  );
}

function Feedback({ type, message }: { type: 'success' | 'error'; message: string }) {
  return (
    <div className={[
      'flex items-center gap-2 rounded-lg px-3 py-2 text-[12px]',
      type === 'success'
        ? 'bg-success-light text-success border border-success/20'
        : 'bg-danger-light text-danger border border-danger/20',
    ].join(' ')}>
      {type === 'success' ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3.5 h-3.5 shrink-0">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3.5 h-3.5 shrink-0">
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      )}
      {message}
    </div>
  );
}

function Spinner() {
  return (
    <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
      <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Section 1 — Display Name
// ---------------------------------------------------------------------------

function DisplayNameSection({ profile, onUpdated }: {
  profile: ProfileResponse;
  onUpdated: (newUsername: string) => void;
}) {
  const [displayName, setDisplayName] = useState(profile.username);
  const [saving,  setSaving]  = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (displayName.trim() === profile.username) {
      setFeedback({ type: 'error', msg: 'Display name is unchanged.' });
      return;
    }
    if (displayName.trim().length < 3) {
      setFeedback({ type: 'error', msg: 'Display name must be at least 3 characters.' });
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      const msg = await updateMyProfile({ displayName: displayName.trim() });
      setFeedback({ type: 'success', msg });
      onUpdated(displayName.trim());
    } catch (err) {
      setFeedback({ type: 'error', msg: extractBackendError(err, 'Failed to update display name.') });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200/80 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="font-serif text-[14px] font-normal text-gray-800">Display Name</h2>
        <p className="text-[11px] text-gray-400 mt-0.5">
          This is the name shown in the sidebar and used to log in.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Current Username</Label>
            <Input value={profile.username} onChange={() => {}} disabled />
          </div>
          <div>
            <Label>New Display Name</Label>
            <Input
              value={displayName}
              onChange={setDisplayName}
              placeholder="Enter new name…"
            />
          </div>
        </div>

        {feedback && <Feedback type={feedback.type} message={feedback.msg} />}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-sidebar text-white text-[12.5px] font-medium rounded-lg hover:bg-sidebar-hover transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            {saving ? <><Spinner /> Saving…</> : 'Update Name'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section 2 — Change Password
// ---------------------------------------------------------------------------

function ChangePasswordSection() {
  const [current,  setCurrent]  = useState('');
  const [next,     setNext]     = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [saving,   setSaving]   = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Live match indicator
  const mismatch = confirm.length > 0 && next !== confirm;
  const weak     = next.length > 0 && next.length < 6;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!current.trim()) {
      setFeedback({ type: 'error', msg: 'Please enter your current password.' });
      return;
    }
    if (next.length < 6) {
      setFeedback({ type: 'error', msg: 'New password must be at least 6 characters.' });
      return;
    }
    if (next !== confirm) {
      setFeedback({ type: 'error', msg: 'New password and confirmation do not match.' });
      return;
    }

    setSaving(true);
    try {
      const msg = await updateMyProfile({
        currentPassword: current,
        newPassword: next,
      });
      setFeedback({ type: 'success', msg });
      setCurrent(''); setNext(''); setConfirm('');
    } catch (err) {
      setFeedback({ type: 'error', msg: extractBackendError(err, 'Failed to update password.') });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200/80 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="font-serif text-[14px] font-normal text-gray-800">Change Password</h2>
        <p className="text-[11px] text-gray-400 mt-0.5">
          Enter your current password to verify your identity before setting a new one.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
        <div>
          <Label>Current Password</Label>
          <Input
            type="password"
            value={current}
            onChange={setCurrent}
            placeholder="Your existing password…"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>New Password</Label>
            <Input
              type="password"
              value={next}
              onChange={setNext}
              placeholder="At least 6 characters"
            />
            {weak && (
              <p className="text-[11px] text-danger mt-1">Minimum 6 characters required.</p>
            )}
          </div>
          <div>
            <Label>Confirm New Password</Label>
            <Input
              type="password"
              value={confirm}
              onChange={setConfirm}
              placeholder="Repeat new password"
            />
            {mismatch && (
              <p className="text-[11px] text-danger mt-1">Passwords do not match.</p>
            )}
            {!mismatch && confirm.length > 0 && next === confirm && (
              <p className="text-[11px] text-success mt-1 flex items-center gap-1">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3 h-3">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
                Passwords match
              </p>
            )}
          </div>
        </div>

        {/* Strength bar */}
        {next.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10.5px] text-gray-400">Password strength</p>
              <p className={`text-[10.5px] font-medium ${
                next.length >= 12 ? 'text-success' : next.length >= 8 ? 'text-gold' : 'text-danger'
              }`}>
                {next.length >= 12 ? 'Strong' : next.length >= 8 ? 'Moderate' : 'Weak'}
              </p>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-300 ${
                next.length >= 12 ? 'bg-success w-full'
                : next.length >= 8  ? 'bg-gold w-2/3'
                : 'bg-danger w-1/3'
              }`} />
            </div>
          </div>
        )}

        {feedback && <Feedback type={feedback.type} message={feedback.msg} />}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving || mismatch || weak}
            className="px-4 py-2 bg-sidebar text-white text-[12.5px] font-medium rounded-lg hover:bg-sidebar-hover transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            {saving ? <><Spinner /> Saving…</> : 'Change Password'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ProfileSettings() {
  const { fullName, role, roleLabel } = useAuth();

  const [profile,  setProfile]  = useState<ProfileResponse | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [fetchErr, setFetchErr] = useState<string | null>(null);

  useEffect(() => {
    getMyProfile()
      .then(setProfile)
      .catch((err) => setFetchErr(extractBackendError(err, 'Failed to load profile.')))
      .finally(() => setLoading(false));
  }, []);

  // Role accent colours
  const roleAccent =
    role === 'ADMIN'       ? 'bg-danger-light text-danger' :
    role === 'PASTOR'      ? 'bg-primary-light text-primary' :
    role === 'ZONE_LEADER' ? 'bg-gold-light text-gold' :
                             'bg-success-light text-success';

  return (
    <div className="max-w-2xl space-y-5">
      {/* Page header */}
      <div>
        <h1 className="font-serif text-lg font-normal text-gray-800">Profile Settings</h1>
        <p className="text-[12px] text-gray-400 mt-0.5">
          Manage your display name and account password.
        </p>
      </div>

      {/* Identity card */}
      <div className="bg-white border border-gray-200/80 rounded-xl px-5 py-4 flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-sidebar flex items-center justify-center text-base font-semibold text-white shrink-0">
          {fullName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-medium text-gray-800">{fullName}</p>
          <p className="text-[11.5px] text-gray-400">
            {loading ? 'Loading…' : (profile?.userId ?? '—')}
          </p>
        </div>
        <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${roleAccent}`}>
          {roleLabel}
        </span>
      </div>

      {/* Loading / error state */}
      {loading && (
        <div className="bg-white border border-gray-200/80 rounded-xl px-5 py-10 text-center text-[12px] text-gray-400">
          Loading profile…
        </div>
      )}
      {!loading && fetchErr && (
        <Feedback type="error" message={fetchErr} />
      )}

      {/* Forms — rendered once profile is loaded */}
      {!loading && !fetchErr && profile && (
        <>
          <DisplayNameSection
            profile={profile}
            onUpdated={(newName) => setProfile((p) => p ? { ...p, username: newName } : p)}
          />
          <ChangePasswordSection />
        </>
      )}
    </div>
  );
}
