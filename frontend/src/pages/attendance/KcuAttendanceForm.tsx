/**
 * KcuAttendanceForm.tsx
 *
 * KCU Leader operational workspace — three-tab interface:
 *
 *   Tab 1 — Attendance Tracker   (check-state grid + Save Transaction)
 *   Tab 2 — Member Roster        (KcuMemberList)
 *   Tab 3 — Follow-Up Queue      (KcuFollowUpList)
 *
 * Backend contracts:
 *   GET  /api/members?kcuId=&status=Active&size=100   → member list
 *   POST /api/attendance/submit                        → attendance payload
 *   GET  /api/followups                               → follow-up worklist
 *   PATCH /api/followups/{id}                         → update follow-up
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import KcuMemberList from '../kcu/KcuMemberList';
import KcuFollowUpList from '../kcu/KcuFollowUpList';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AttendanceStatus = 'present' | 'absent' | 'excused';
type EventType = 'KCU' | 'SUNDAY' | 'WEDNESDAY' | 'SPECIAL';
type KcuTab = 'attendance' | 'members' | 'followup';

interface MemberRow {
  memberId: string;
  fullName: string;
  kcuName: string | null;
}

interface AttendanceSubmissionDTO {
  memberId: string;
  eventType: EventType;
  attDate: string;
  status: 'PRESENT' | 'ABSENT';
}

interface SubmitResponse {
  status: string;
  message: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Safely extract a plain array from a raw array or Spring Page wrapper. */
function toArray<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>;
    if (Array.isArray(d.content)) return d.content as T[];
  }
  return [];
}

const AVATAR_VARIANTS = [
  'bg-primary-light text-primary',
  'bg-success-light text-success',
  'bg-gold-light text-gold',
  'bg-danger-light text-danger',
] as const;

function avatarClass(id: string): string {
  const sum = id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_VARIANTS[sum % AVATAR_VARIANTS.length];
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------

function StatCard({
  label, value, sub, accent, icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-gray-200/80 rounded-xl p-4">
      <div className={`w-8 h-8 ${accent} rounded-lg flex items-center justify-center mb-2.5`}>
        {icon}
      </div>
      <p className="text-[11px] text-gray-400 mb-1.5">{label}</p>
      <p className="text-2xl font-medium text-gray-800 leading-none">{value}</p>
      {sub && <p className="text-[11px] mt-1 text-gray-400">{sub}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Progress bar
// ---------------------------------------------------------------------------

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
// Tab 1 — Attendance Tracker
// ---------------------------------------------------------------------------

function AttendanceTracker() {
  const { assignedKcuId } = useAuth();

  const [members, setMembers]           = useState<MemberRow[]>([]);
  const [loading, setLoading]           = useState(false);
  const [fetchError, setFetchError]     = useState<string | null>(null);
  const [attendance, setAttendance]     = useState<Record<string, AttendanceStatus>>({});
  const [submitting, setSubmitting]     = useState(false);
  const [submitResult, setSubmitResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [eventType, setEventType]       = useState<EventType>('KCU');
  const [sessionDate, setSessionDate]   = useState<string>(toIsoDate(new Date()));

  // Fetch members — normalise through toArray() to handle both plain arrays
  // and Spring Page { content: [...] } responses without crashing.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFetchError(null);
    setSubmitResult(null);

    const params = new URLSearchParams({ status: 'Active', size: '100', sort: 'fullName,asc' });
    if (assignedKcuId) params.set('kcuId', assignedKcuId);

    api.get(`/api/members?${params.toString()}`)
      .then((res) => {
        if (cancelled) return;
        const safeMembers = toArray<MemberRow>(res.data);
        setMembers(safeMembers);
        setAttendance(
          Object.fromEntries(safeMembers.map((m) => [m.memberId, 'present' as AttendanceStatus])),
        );
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setFetchError(err instanceof Error ? err.message : 'Failed to load members');
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [assignedKcuId]);

  const stats = useMemo(() => {
    const safeMembers = Array.isArray(members) ? members : [];
    const total   = safeMembers.length;
    const present = safeMembers.filter((m) => attendance[m.memberId] === 'present').length;
    const absent  = safeMembers.filter((m) => attendance[m.memberId] === 'absent').length;
    const excused = safeMembers.filter((m) => attendance[m.memberId] === 'excused').length;
    const rate    = total > 0 ? Math.round((present / total) * 100) : 0;
    return { total, present, absent, excused, rate };
  }, [attendance, members]);

  const setStatus = useCallback((id: string, status: AttendanceStatus) =>
    setAttendance((prev) => ({ ...prev, [id]: status })), []);

  const markAll = useCallback((status: AttendanceStatus) => {
    const safeMembers = Array.isArray(members) ? members : [];
    setAttendance(Object.fromEntries(safeMembers.map((m) => [m.memberId, status])));
  }, [members]);

  const togglePresent = useCallback((id: string) =>
    setAttendance((prev) => ({ ...prev, [id]: prev[id] === 'present' ? 'absent' : 'present' })), []);

  const handleSubmit = useCallback(async () => {
    const safeMembers = Array.isArray(members) ? members : [];
    if (safeMembers.length === 0) return;
    setSubmitting(true);
    setSubmitResult(null);

    const payload: AttendanceSubmissionDTO[] = safeMembers.map((m) => ({
      memberId:  m.memberId,
      eventType,
      attDate:   sessionDate,
      status:    attendance[m.memberId] === 'present' ? 'PRESENT' : 'ABSENT',
    }));

    try {
      const res = await api.post<SubmitResponse>('/api/attendance/submit', payload);
      setSubmitResult({ ok: true, message: res.data.message ?? 'Attendance saved.' });
    } catch (err: unknown) {
      setSubmitResult({ ok: false, message: err instanceof Error ? err.message : 'Submission failed' });
    } finally {
      setSubmitting(false);
    }
  }, [members, attendance, eventType, sessionDate]);

  const displayDate = new Date(sessionDate + 'T00:00:00').toLocaleDateString('en-GB', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const safeMembers = Array.isArray(members) ? members : [];

  return (
    <div className="space-y-4">
      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard
          label="Total Members" value={loading ? '—' : stats.total}
          sub="In this session" accent="bg-primary-light"
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4 text-primary"><circle cx="9" cy="7" r="4" /><path d="M2 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2" /></svg>}
        />
        <StatCard
          label="Present" value={loading ? '—' : stats.present}
          sub={loading ? '' : `${stats.rate}% rate`} accent="bg-success-light"
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4 text-success"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>}
        />
        <StatCard
          label="Absent" value={loading ? '—' : stats.absent}
          sub={stats.absent > 0 ? 'Needs follow-up' : 'All accounted for'} accent="bg-danger-light"
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4 text-danger"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>}
        />
        <StatCard
          label="Excused" value={loading ? '—' : stats.excused}
          sub="With valid reason" accent="bg-gold-light"
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4 text-gold"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>}
        />
      </div>

      {/* Attendance card */}
      <div className="bg-white border border-gray-200/80 rounded-xl">
        {/* Card header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-100 flex-wrap gap-2">
          <div>
            <h2 className="font-serif text-[15px] font-normal text-gray-800">Member Check-In Grid</h2>
            <p className="text-[11px] text-gray-400 mt-0.5">{displayDate}</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end">
            {/* Event type selector */}
            <select
              value={eventType}
              onChange={(e) => setEventType(e.target.value as EventType)}
              className="text-xs border border-gray-200 rounded-md px-2 py-1.5 text-gray-600 bg-white cursor-pointer focus:outline-none focus:border-primary"
            >
              <option value="KCU">Weekly KCU Meeting</option>
              <option value="SUNDAY">Sunday Attendance</option>
              <option value="WEDNESDAY">Wednesday Attendance</option>
              <option value="SPECIAL">Special Events Attendance</option>
            </select>

            {/* Date picker */}
            <input
              type="date"
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
              className="text-xs border border-gray-200 rounded-md px-2 py-1.5 text-gray-600 bg-white cursor-pointer focus:outline-none focus:border-primary"
            />

            {/* Bulk mark buttons */}
            <button
              onClick={() => markAll('present')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-success border border-success/30 bg-success-light rounded-md hover:bg-success/10 transition-colors cursor-pointer"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5"><path d="M20 6L9 17l-5-5" /></svg>
              All Present
            </button>
            <button
              onClick={() => markAll('absent')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-danger border border-danger/30 bg-danger-light rounded-md hover:bg-danger/10 transition-colors cursor-pointer"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              All Absent
            </button>
            <button
              onClick={() => markAll('excused')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gold border border-gold/30 bg-gold-light rounded-md hover:bg-gold/10 transition-colors cursor-pointer"
            >
              All Excused
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] text-gray-500">Session attendance rate</span>
            <span className="text-[11px] font-medium text-gray-700">{stats.present}/{stats.total} present</span>
          </div>
          <ProgressBar
            value={stats.rate}
            colorClass={stats.rate >= 75 ? 'bg-success' : stats.rate >= 50 ? 'bg-gold' : 'bg-danger'}
          />
        </div>

        {/* Loading / error / empty states */}
        {loading && (
          <div className="px-4 py-10 text-center text-[12px] text-gray-400">Loading members…</div>
        )}
        {!loading && fetchError && (
          <div className="px-4 py-6 text-center">
            <p className="text-[12px] text-danger">{fetchError}</p>
            <p className="text-[11px] text-gray-400 mt-1">Check that the Spring Boot backend is running on port 8080.</p>
          </div>
        )}
        {!loading && !fetchError && safeMembers.length === 0 && (
          <div className="px-4 py-10 text-center text-[12px] text-gray-400">
            No active members found for your KCU group.
          </div>
        )}

        {/* Member rows — explicit Array.isArray guard before mapping */}
        {!loading && !fetchError && Array.isArray(safeMembers) && safeMembers.length > 0 && (
          <div className="divide-y divide-gray-100">
            {safeMembers.map((member) => {
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
                      status === 'present' ? 'bg-success border-success' : 'border-gray-300 bg-white',
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
                    <p className="text-[11px] text-gray-400">{member.kcuName ?? '—'}</p>
                  </div>

                  {/* Status pills */}
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

        {/* Footer — Save Transaction */}
        <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div>
            <p className="text-[11px] text-gray-400">
              {stats.present} present · {stats.absent} absent · {stats.excused} excused
            </p>
            {submitResult && (
              <p className={`text-[11px] mt-0.5 ${submitResult.ok ? 'text-success' : 'text-danger'}`}>
                {submitResult.ok ? '✓ ' : '✗ '}{submitResult.message}
              </p>
            )}
          </div>
          <button
            onClick={handleSubmit}
            disabled={submitting || safeMembers.length === 0}
            className="px-4 py-1.5 bg-sidebar text-white text-xs font-medium rounded-md hover:bg-sidebar-hover transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            {submitting ? (
              <>
                <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
                </svg>
                Saving…
              </>
            ) : 'Save Transaction'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Root — tabbed workspace shell
// ---------------------------------------------------------------------------

const TABS: { id: KcuTab; label: string; icon: React.ReactNode }[] = [
  {
    id: 'attendance',
    label: 'Attendance',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
        <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
    ),
  },
  {
    id: 'members',
    label: 'My Members',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
        <circle cx="9" cy="7" r="4" /><path d="M2 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2" />
      </svg>
    ),
  },
  {
    id: 'followup',
    label: 'Follow-Up',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    ),
  },
];

export default function KcuAttendanceForm() {
  const [activeTab, setActiveTab] = useState<KcuTab>('attendance');

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div>
        <h1 className="font-serif text-lg font-normal text-gray-800">KCU Leader Workspace</h1>
        <p className="text-[12px] text-gray-400 mt-0.5">
          Manage attendance, view your members, and track pastoral follow-ups
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 bg-white border border-gray-200/80 rounded-xl p-1 w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={[
              'flex items-center gap-2 px-4 py-2 rounded-lg text-[12.5px] transition-all duration-150 cursor-pointer',
              activeTab === tab.id
                ? 'bg-sidebar text-white font-medium shadow-sm'
                : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50',
            ].join(' ')}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'attendance' && <AttendanceTracker />}
      {activeTab === 'members'    && <KcuMemberList />}
      {activeTab === 'followup'   && <KcuFollowUpList />}
    </div>
  );
}
