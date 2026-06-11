/**
 * AttendanceView.tsx
 *
 * Attendance register page.
 *
 * Data flow:
 *  1. On mount (and whenever role / scope IDs change), calls
 *     memberService.getMembers() with the correct kcuId or zoneId
 *     derived from AuthContext.
 *  2. Local state tracks each member's attendance status.
 *  3. "Submit Attendance" maps the state to AttendanceSubmissionDTO[]
 *     and POSTs to POST /api/attendance/submit via the Axios client.
 *
 * Backend contract (API_SPECIFICATION.md):
 *   GET  /api/members?kcuId=&zoneId=&status=Active&size=100
 *   POST /api/attendance/submit  ← array of AttendanceSubmissionDTO
 *
 * AttendanceSubmissionDTO only accepts PRESENT | ABSENT.
 * "Excused" is a UI-only status; it maps to ABSENT on submit.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { getMembers, type MemberSummary } from '../services/memberService';
import api from '../services/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** UI-level attendance status — richer than the backend's binary. */
type AttendanceStatus = 'present' | 'absent' | 'excused';

/** Allowed event types from the backend spec. */
type EventType = 'KCU' | 'SUNDAY' | 'WEDNESDAY' | 'SPECIAL';

/** Single record in the POST /api/attendance/submit payload. */
interface AttendanceSubmissionDTO {
  memberId: string;
  eventType: EventType;
  /** ISO-8601 date string: "YYYY-MM-DD" */
  attDate: string;
  /** Backend only accepts PRESENT | ABSENT — excused maps to ABSENT. */
  status: 'PRESENT' | 'ABSENT';
}

/** Shape of the success response from POST /api/attendance/submit. */
interface SubmitResponse {
  status: string;
  message: string;
}

// ---------------------------------------------------------------------------
// Avatar colour cycling (deterministic from memberId string)
// ---------------------------------------------------------------------------

const AVATAR_VARIANTS = [
  'bg-primary-light text-primary',
  'bg-success-light text-success',
  'bg-gold-light text-gold',
  'bg-danger-light text-danger',
] as const;

function avatarClass(memberId: string): string {
  const sum = memberId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_VARIANTS[sum % AVATAR_VARIANTS.length];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format a Date as "YYYY-MM-DD" for the backend. */
function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  subVariant?: 'up' | 'down' | 'neutral';
  accent?: string;
  icon: React.ReactNode;
}

function StatCard({
  label, value, sub, subVariant = 'neutral', accent = 'bg-primary-light', icon,
}: StatCardProps) {
  const subColor =
    subVariant === 'up'   ? 'text-success' :
    subVariant === 'down' ? 'text-danger'  : 'text-gray-400';
  return (
    <div className="bg-white border border-gray-200/80 rounded-xl p-4">
      <div className={`w-8 h-8 ${accent} rounded-lg flex items-center justify-center mb-2.5`}>
        {icon}
      </div>
      <p className="text-[11px] text-gray-400 mb-1.5">{label}</p>
      <p className="text-2xl font-medium text-gray-800 leading-none">{value}</p>
      {sub && <p className={`text-[11px] mt-1 ${subColor}`}>{sub}</p>}
    </div>
  );
}

function ProgressBar({ value, colorClass = 'bg-primary' }: { value: number; colorClass?: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${colorClass} transition-all duration-300`}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-[11px] text-gray-400 w-8 text-right">{value}%</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function AttendanceView() {
  const { role, assignedZoneId, assignedKcuId } = useAuth();

  // ── Remote member list ────────────────────────────────────────────────────
  const [members, setMembers]     = useState<MemberSummary[]>([]);
  const [loading, setLoading]     = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // ── Attendance state: memberId → UI status ────────────────────────────────
  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>({});

  // ── Submit state ──────────────────────────────────────────────────────────
  const [submitting, setSubmitting]   = useState(false);
  const [submitResult, setSubmitResult] = useState<{
    ok: boolean; message: string;
  } | null>(null);

  // ── Session config ────────────────────────────────────────────────────────
  const [eventType, setEventType] = useState<EventType>('SUNDAY');
  const [sessionDate, setSessionDate] = useState<string>(toIsoDate(new Date()));

  // ── Fetch members whenever role / scope changes ───────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFetchError(null);
    setSubmitResult(null);

    // Build query params based on role scope.
    // RBAC fence on the backend handles further restriction automatically;
    // we just pass the IDs we have so the list is pre-filtered.
    const params: Parameters<typeof getMembers>[0] = {
      status: 'Active',
      size: 100,
      sort: 'fullName,asc',
    };

    if (role === 'KCU_LEADER' && assignedKcuId) {
      params.kcuId = assignedKcuId;
    } else if (role === 'ZONE_LEADER' && assignedZoneId) {
      params.zoneId = assignedZoneId;
    }
    // PASTOR: no extra filter — backend returns all within their scope

    getMembers(params)
      .then((page) => {
        if (cancelled) return;
        setMembers(page.content);
        // Initialise every fetched member as 'present'
        setAttendance(
          Object.fromEntries(page.content.map((m) => [m.memberId, 'present' as AttendanceStatus])),
        );
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : 'Failed to load members';
        setFetchError(msg);
        console.error('[AttendanceView] getMembers error:', err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [role, assignedZoneId, assignedKcuId]);

  // ── Derived stats ─────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total   = members.length;
    const present = members.filter((m) => attendance[m.memberId] === 'present').length;
    const absent  = members.filter((m) => attendance[m.memberId] === 'absent').length;
    const excused = members.filter((m) => attendance[m.memberId] === 'excused').length;
    const rate    = total > 0 ? Math.round((present / total) * 100) : 0;
    return { total, present, absent, excused, rate };
  }, [attendance, members]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const setStatus = useCallback((id: string, status: AttendanceStatus) =>
    setAttendance((prev) => ({ ...prev, [id]: status })), []);

  const markAll = useCallback((status: AttendanceStatus) =>
    setAttendance(Object.fromEntries(members.map((m) => [m.memberId, status]))), [members]);

  const togglePresent = useCallback((id: string) =>
    setAttendance((prev) => ({ ...prev, [id]: prev[id] === 'present' ? 'absent' : 'present' })), []);

  /**
   * Build the submission payload and POST to /api/attendance/submit.
   * "excused" maps to ABSENT — the backend's Care Engine only knows PRESENT/ABSENT.
   */
  const handleSubmit = useCallback(async () => {
    if (members.length === 0) return;
    setSubmitting(true);
    setSubmitResult(null);

    const payload: AttendanceSubmissionDTO[] = members.map((m) => ({
      memberId:  m.memberId,
      eventType,
      attDate:   sessionDate,
      status:    attendance[m.memberId] === 'present' ? 'PRESENT' : 'ABSENT',
    }));

    try {
      const res = await api.post<SubmitResponse>('/api/attendance/submit', payload);
      setSubmitResult({ ok: true, message: res.data.message });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Submission failed';
      setSubmitResult({ ok: false, message: msg });
      console.error('[AttendanceView] submit error:', err);
    } finally {
      setSubmitting(false);
    }
  }, [members, attendance, eventType, sessionDate]);

  // ── Render ────────────────────────────────────────────────────────────────

  const displayDate = new Date(sessionDate + 'T00:00:00').toLocaleDateString('en-GB', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <div className="space-y-4">
      {/* ------------------------------------------------------------------ */}
      {/* Stat cards                                                           */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard
          label="Total Members"
          value={loading ? '—' : stats.total}
          sub="In this session"
          accent="bg-primary-light"
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4 text-primary">
              <circle cx="9" cy="7" r="4" /><path d="M2 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2" />
            </svg>
          }
        />
        <StatCard
          label="Present"
          value={loading ? '—' : stats.present}
          sub={loading ? '' : `${stats.rate}% attendance rate`}
          subVariant={stats.rate >= 75 ? 'up' : 'down'}
          accent="bg-success-light"
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4 text-success">
              <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
          }
        />
        <StatCard
          label="Absent"
          value={loading ? '—' : stats.absent}
          sub={stats.absent > 0 ? 'Needs follow-up' : 'All accounted for'}
          subVariant={stats.absent > 0 ? 'down' : 'up'}
          accent="bg-danger-light"
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4 text-danger">
              <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          }
        />
        <StatCard
          label="Excused"
          value={loading ? '—' : stats.excused}
          sub="With valid reason"
          accent="bg-gold-light"
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4 text-gold">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          }
        />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Attendance card                                                      */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white border border-gray-200/80 rounded-xl">

        {/* Card header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-100">
          <div>
            <h2 className="font-serif text-[15px] font-normal text-gray-800">Attendance Register</h2>
            <p className="text-[11px] text-gray-400 mt-0.5">{displayDate}</p>
          </div>

          {/* Session config + bulk actions */}
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {/* Event type selector */}
            <select
              value={eventType}
              onChange={(e) => setEventType(e.target.value as EventType)}
              className="text-xs border border-gray-200 rounded-md px-2 py-1.5 text-gray-600 bg-white cursor-pointer focus:outline-none focus:border-primary"
            >
              <option value="SUNDAY">Sunday Service</option>
              <option value="KCU">KCU Meeting</option>
              <option value="WEDNESDAY">Wednesday Service</option>
              <option value="SPECIAL">Special Event</option>
            </select>

            {/* Date picker */}
            <input
              type="date"
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
              className="text-xs border border-gray-200 rounded-md px-2 py-1.5 text-gray-600 bg-white cursor-pointer focus:outline-none focus:border-primary"
            />

            <button
              onClick={() => markAll('present')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-success border border-success/30 bg-success-light rounded-md hover:bg-success/10 transition-colors cursor-pointer"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              All Present
            </button>
            <button
              onClick={() => markAll('absent')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-danger border border-danger/30 bg-danger-light rounded-md hover:bg-danger/10 transition-colors cursor-pointer"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              All Absent
            </button>
            <button
              onClick={() => markAll('excused')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-warning border border-warning/30 bg-warning-light rounded-md hover:bg-warning/10 transition-colors cursor-pointer"
            >
              All Excused
            </button>
          </div>
        </div>

        {/* Progress summary bar */}
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] text-gray-500">Session attendance rate</span>
            <span className="text-[11px] font-medium text-gray-700">
              {stats.present}/{stats.total} present
            </span>
          </div>
          <ProgressBar
            value={stats.rate}
            colorClass={stats.rate >= 75 ? 'bg-success' : stats.rate >= 50 ? 'bg-gold' : 'bg-danger'}
          />
        </div>

        {/* ── Loading / error / empty states ── */}
        {loading && (
          <div className="px-4 py-10 text-center text-[12px] text-gray-400">
            Loading members…
          </div>
        )}
        {!loading && fetchError && (
          <div className="px-4 py-6 text-center">
            <p className="text-[12px] text-danger">{fetchError}</p>
            <p className="text-[11px] text-gray-400 mt-1">
              Check that the Spring Boot backend is running on port 8080.
            </p>
          </div>
        )}
        {!loading && !fetchError && members.length === 0 && (
          <div className="px-4 py-10 text-center text-[12px] text-gray-400">
            No active members found for this scope.
          </div>
        )}

        {/* Member rows */}
        {!loading && !fetchError && members.length > 0 && (
          <div className="divide-y divide-gray-100">
            {members.map((member) => {
              const status = attendance[member.memberId] ?? 'present';
              return (
                <div
                  key={member.memberId}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50/70 transition-colors"
                >
                  {/* Checkbox — toggles present/absent */}
                  <button
                    onClick={() => togglePresent(member.memberId)}
                    aria-label={`Toggle attendance for ${member.fullName}`}
                    className={[
                      'w-[18px] h-[18px] rounded border-[1.5px] flex items-center justify-center shrink-0 transition-colors cursor-pointer',
                      status === 'present'
                        ? 'bg-success border-success'
                        : 'border-gray-300 bg-white',
                    ].join(' ')}
                  >
                    {status === 'present' && (
                      <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} className="w-3 h-3">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    )}
                  </button>

                  {/* Avatar */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium shrink-0 ${avatarClass(member.memberId)}`}>
                    {member.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                  </div>

                  {/* Name + KCU */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[12.5px] font-medium text-gray-800 truncate">{member.fullName}</p>
                    <p className="text-[11px] text-gray-400">{member.kcuName ?? member.zoneName ?? '—'}</p>
                  </div>

                  {/* Status selector */}
                  <div className="flex items-center gap-1.5">
                    {(['present', 'absent', 'excused'] as AttendanceStatus[]).map((s) => (
                      <button
                        key={s}
                        onClick={() => setStatus(member.memberId, s)}
                        className={[
                          'px-2.5 py-0.5 rounded-full text-[11px] font-medium capitalize transition-colors cursor-pointer',
                          status === s
                            ? s === 'present' ? 'bg-success-light text-success'
                            : s === 'absent'  ? 'bg-danger-light text-danger'
                            :                   'bg-gold-light text-gold'
                            : 'bg-gray-100 text-gray-400 hover:bg-gray-200',
                        ].join(' ')}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Card footer — submit */}
        <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div>
            <p className="text-[11px] text-gray-400">
              {stats.present} present · {stats.absent} absent · {stats.excused} excused
            </p>
            {/* Submit result banner */}
            {submitResult && (
              <p className={`text-[11px] mt-0.5 ${submitResult.ok ? 'text-success' : 'text-danger'}`}>
                {submitResult.ok ? '✓ ' : '✗ '}{submitResult.message}
              </p>
            )}
          </div>
          <button
            onClick={handleSubmit}
            disabled={submitting || members.length === 0}
            className="px-4 py-1.5 bg-sidebar text-white text-xs font-medium rounded-md hover:bg-sidebar-hover transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Submitting…' : 'Submit Attendance'}
          </button>
        </div>
      </div>
    </div>
  );
}
