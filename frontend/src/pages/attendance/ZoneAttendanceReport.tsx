/**
 * ZoneAttendanceReport.tsx
 *
 * Zone Leader operational workspace — four-tab interface:
 *
 *   Tab 1 — KCU Directory     (cell group list + member drill-down)
 *   Tab 2 — Attendance Overview (multi-event submission status table)
 *   Tab 3 — Follow-Up Alerts  (zone-wide care queue with inline update)
 *   Tab 4 — Reports & Analytics (performance trends + export actions)
 *
 * All fetches use .catch(() => null) so a 404 / network error never crashes
 * the page. All .map() calls are guarded with Array.isArray().
 *
 * Backend endpoints used:
 *   GET /api/kcus?zoneId=              → KCU list for this zone (all roles)
 *   GET /api/members?zoneId=&kcuId=      → member list (paginated)
 *   GET /api/attendance/report?period=&zoneId=  → attendance metrics
 *   GET /api/followups                   → follow-up worklist (RBAC-scoped)
 *   PATCH /api/followups/{followupId}    → update follow-up case
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import type { MemberSummary } from '../../services/memberService';

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

type ZoneTab = 'directory' | 'attendance' | 'followup' | 'reports';

interface KcuRecord {
  kcuId: string | number;  // backend serializes Long as a JSON number
  kcuName: string;
  kcuLeader: string | null;
  leaderPhone: string | null;
  meetingDay: string | null;
  meetingTime: string | null;
  location: string | null;
  zone?: { zoneId: string; zoneName: string } | null;
}

interface FollowUpDTO {
  followupId: string;
  memberId: string;
  memberName: string;
  memberPhone: string;
  kcuName: string;
  reason: string;
  status: 'PENDING' | 'RESOLVED';
  assignedToUserId: string | null;
  assignedToName: string | null;
  notes: string | null;
  createdAt: string;
}

interface KcuMetric {
  kcuId: string;
  kcuName: string;
  leaderName: string;
  totalMembers: number;
  presentCount: number;
  absentCount: number;
  attendanceRate: number;
  submittedAt: string | null;
}

interface ZoneReport {
  zoneId: string;
  zoneName: string;
  totalMembers: number;
  presentCount: number;
  attendanceRate: number;
  kcuBreakdown: KcuMetric[];
}

// ---------------------------------------------------------------------------
// Shared helpers
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

function rateColor(rate: number): string {
  if (rate >= 75) return 'text-success';
  if (rate >= 50) return 'text-gold';
  return 'text-danger';
}

function rateBarColor(rate: number): string {
  if (rate >= 75) return 'bg-success';
  if (rate >= 50) return 'bg-gold';
  return 'bg-danger';
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return 'Just now';
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function isOverdue(iso: string): boolean {
  return Date.now() - new Date(iso).getTime() > 72 * 3_600_000;
}

const AVATAR_VARIANTS = [
  'bg-primary-light text-primary',
  'bg-success-light text-success',
  'bg-gold-light text-gold',
  'bg-danger-light text-danger',
] as const;

function avatarClass(id: string | number): string {
  const safeId = id != null ? String(id) : '';
  const sum = safeId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_VARIANTS[sum % AVATAR_VARIANTS.length];
}

// ---------------------------------------------------------------------------
// Shared UI atoms
// ---------------------------------------------------------------------------

function Spinner() {
  return (
    <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2.5}>
      <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
    </svg>
  );
}

function RefreshBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="text-[11px] text-gray-400 hover:text-gray-700 flex items-center gap-1.5 transition-colors cursor-pointer">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-3.5 h-3.5">
        <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
      </svg>
      Refresh
    </button>
  );
}

function EmptyState({ message, sub }: { message: string; sub?: string }) {
  return (
    <div className="px-4 py-10 text-center">
      <p className="text-[12px] text-gray-400">{message}</p>
      {sub && <p className="text-[11px] text-gray-300 mt-1">{sub}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Follow-up inline update form (reused across Tab 3)
// ---------------------------------------------------------------------------

interface UpdateFormProps {
  item: FollowUpDTO;
  onSaved: (updated: FollowUpDTO) => void;
  onCancel: () => void;
}

function FollowUpUpdateForm({ item, onSaved, onCancel }: UpdateFormProps) {
  const [status, setStatus] = useState<'PENDING' | 'RESOLVED'>(item.status);
  const [notes, setNotes]   = useState(item.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await api.patch<FollowUpDTO>(`/api/followups/${item.followupId}`, {
        status,
        notes: notes.trim() || null,
      });
      onSaved(res.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-2 bg-gray-50 border border-gray-200 rounded-lg px-3.5 py-3 space-y-3">
      <div>
        <p className="text-[10.5px] font-medium text-gray-500 mb-1.5 uppercase tracking-[0.07em]">
          Update Status
        </p>
        <div className="flex gap-2">
          {(['PENDING', 'RESOLVED'] as const).map((s) => (
            <button key={s} onClick={() => setStatus(s)}
              className={[
                'px-3 py-1 rounded-full text-[11px] font-medium transition-colors cursor-pointer',
                status === s
                  ? s === 'RESOLVED' ? 'bg-success text-white' : 'bg-gold text-white'
                  : 'bg-white border border-gray-200 text-gray-500 hover:border-gray-300',
              ].join(' ')}>
              {s === 'PENDING' ? 'Keep Pending' : 'Mark Resolved'}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-[10.5px] font-medium text-gray-500 mb-1.5 uppercase tracking-[0.07em]">
          Supervisory Care Notes
        </p>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
          placeholder="Add zone leader notes, escalation details, or pastoral observations…"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[12px] text-gray-800 bg-white placeholder-gray-300 focus:outline-none focus:border-primary transition-colors resize-none" />
      </div>
      {error && <p className="text-[11px] text-danger">✗ {error}</p>}
      <div className="flex items-center justify-end gap-2">
        <button onClick={onCancel}
          className="px-3 py-1.5 text-[11.5px] text-gray-500 border border-gray-200 rounded-md hover:bg-gray-100 transition-colors cursor-pointer">
          Cancel
        </button>
        <button onClick={handleSave} disabled={saving}
          className="px-3.5 py-1.5 bg-sidebar text-white text-[11.5px] font-medium rounded-md hover:bg-sidebar-hover transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5">
          {saving ? <><Spinner /> Saving…</> : 'Save Update'}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 1 — KCU Directory & Roster Drill-down
// ---------------------------------------------------------------------------

function KcuDirectory({ assignedZoneId }: { assignedZoneId: string | null }) {
  const [kcus, setKcus]           = useState<KcuRecord[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [expanded, setExpanded]   = useState<string | null>(null);

  // Per-KCU member lists — loaded lazily on first expand
  const [memberMap, setMemberMap] = useState<Record<string, MemberSummary[]>>({});
  const [memberLoading, setMemberLoading] = useState<Record<string, boolean>>({});

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const url = assignedZoneId
      ? `/api/kcus?zoneId=${assignedZoneId}`
      : '/api/kcus';
    api.get(url)
      .catch(() => null)
      .then((res) => setKcus(res ? toArray<KcuRecord>(res.data) : []))
      .catch(() => setError('Failed to load KCU directory'))
      .finally(() => setLoading(false));
  }, [assignedZoneId]);

  useEffect(() => { load(); }, [load]);

  const loadMembers = useCallback((kcuId: string) => {
    if (memberMap[kcuId] !== undefined) return; // already loaded
    setMemberLoading((prev) => ({ ...prev, [kcuId]: true }));
    const params = new URLSearchParams({ kcuId, status: 'Active', size: '100', sort: 'fullName,asc' });
    api.get(`/api/members?${params.toString()}`)
      .catch(() => null)
      .then((res) => {
        const list = res ? toArray<MemberSummary>(res.data) : [];
        setMemberMap((prev) => ({ ...prev, [kcuId]: list }));
      })
      .finally(() => setMemberLoading((prev) => ({ ...prev, [kcuId]: false })));
  }, [memberMap]);

  const toggle = (kcuId: string) => {
    if (expanded === kcuId) {
      setExpanded(null);
    } else {
      setExpanded(kcuId);
      loadMembers(kcuId);
    }
  };

  const safeKcus = Array.isArray(kcus) ? kcus : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-[15px] font-normal text-gray-800">KCU Directory</h2>
          <p className="text-[11px] text-gray-400 mt-0.5">
            {loading ? 'Loading…' : `${safeKcus.length} cell group${safeKcus.length !== 1 ? 's' : ''} in your zone`}
          </p>
        </div>
        <RefreshBtn onClick={load} />
      </div>

      <div className="bg-white border border-gray-200/80 rounded-xl overflow-hidden">
        {loading && <EmptyState message="Loading KCU directory…" />}
        {!loading && error && (
          <div className="px-4 py-6 text-center">
            <p className="text-[12px] text-danger">{error}</p>
            <p className="text-[11px] text-gray-400 mt-1">Check that the backend is running on port 8080.</p>
          </div>
        )}
        {!loading && !error && safeKcus.length === 0 && (
          <EmptyState message="No KCUs found for your zone."
            sub="KCUs are created by the Administrator." />
        )}

        {!loading && !error && safeKcus.length > 0 && (
          <div className="divide-y divide-gray-100">
            {safeKcus.map((kcu) => {
              // Normalize kcuId to string — backend serializes Long as a JSON number
              const kcuIdStr = String(kcu.kcuId);
              const isOpen = expanded === kcuIdStr;
              const members = memberMap[kcuIdStr];
              const isLoadingMembers = memberLoading[kcuIdStr] ?? false;
              const safeMembers = Array.isArray(members) ? members : [];

              return (
                <div key={`kcu-${kcuIdStr}`}>
                  {/* KCU row — click to expand */}
                  <button
                    onClick={() => toggle(kcuIdStr)}
                    className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50/70 transition-colors text-left cursor-pointer"
                  >
                    {/* Chevron */}
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                      className={`w-3.5 h-3.5 text-gray-400 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}>
                      <polyline points="9 18 15 12 9 6" />
                    </svg>

                    {/* KCU avatar */}
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-semibold shrink-0 ${avatarClass(kcuIdStr)}`}>
                      {kcu.kcuName.slice(0, 2).toUpperCase()}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[12.5px] font-medium text-gray-800">{kcu.kcuName}</p>
                      <p className="text-[11px] text-gray-400">
                        {kcu.kcuLeader ?? 'No leader assigned'}
                        {kcu.meetingDay ? ` · ${kcu.meetingDay}${kcu.meetingTime ? ` ${kcu.meetingTime}` : ''}` : ''}
                      </p>
                    </div>

                    {/* Member count badge */}
                    {members !== undefined && (
                      <span className="shrink-0 text-[11px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                        {safeMembers.length} members
                      </span>
                    )}
                  </button>

                  {/* Drill-down member list */}
                  {isOpen && (
                    <div className="border-t border-gray-100 bg-gray-50/40">
                      {/* KCU meta strip */}
                      <div className="px-12 py-2 flex items-center gap-4 flex-wrap border-b border-gray-100">
                        {kcu.location && (
                          <span className="text-[11px] text-gray-500 flex items-center gap-1">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-3 h-3 text-gray-400">
                              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
                            </svg>
                            {kcu.location}
                          </span>
                        )}
                        {kcu.leaderPhone && (
                          <span className="text-[11px] text-gray-500 flex items-center gap-1">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-3 h-3 text-gray-400">
                              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13.1 19.79 19.79 0 0 1 1.61 4.48 2 2 0 0 1 3.6 2.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.06 6.06l.95-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                            </svg>
                            {kcu.leaderPhone}
                          </span>
                        )}
                      </div>

                      {/* Member rows */}
                      {isLoadingMembers && (
                        <div className="px-12 py-6 text-center text-[12px] text-gray-400">Loading members…</div>
                      )}
                      {!isLoadingMembers && safeMembers.length === 0 && (
                        <div className="px-12 py-6 text-center text-[12px] text-gray-400">No active members in this KCU.</div>
                      )}
                      {!isLoadingMembers && safeMembers.length > 0 && (
                        <>
                          <div className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-3 px-12 py-2 bg-gray-100/60">
                            {['Name', 'Phone', 'Gender', 'Baptism'].map((h) => (
                              <span key={h} className="text-[10px] text-gray-400 uppercase tracking-[0.07em] font-medium">{h}</span>
                            ))}
                          </div>
                          <div className="divide-y divide-gray-100/80">
                            {Array.isArray(safeMembers) ? safeMembers.map((m) => (
                              <div key={m.memberId}
                                className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-3 px-12 py-2.5 items-center hover:bg-white/60 transition-colors">
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium shrink-0 ${avatarClass(m.memberId)}`}>
                                    {m.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                                  </div>
                                  <span className="text-[12px] font-medium text-gray-800 truncate">{m.fullName}</span>
                                </div>
                                <span className="text-[11.5px] text-gray-500 font-mono">{m.phone}</span>
                                <span className="text-[11.5px] text-gray-500">{m.gender}</span>
                                <span className={[
                                  'inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium w-fit',
                                  m.baptismStatus === 'Baptized' ? 'bg-success-light text-success'
                                  : m.baptismStatus === 'Candidate' ? 'bg-gold-light text-gold'
                                  : 'text-gray-300',
                                ].join(' ')}>
                                  {m.baptismStatus ?? '—'}
                                </span>
                              </div>
                            )) : null}
                          </div>
                          <div className="px-12 py-2 border-t border-gray-100 bg-gray-50/50">
                            <p className="text-[10.5px] text-gray-400">
                              {safeMembers.filter((m) => m.baptismStatus === 'Baptized').length} baptized ·{' '}
                              {safeMembers.filter((m) => m.baptismStatus === 'Candidate').length} candidates
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 2 — Multi-Event Attendance Overview
// ---------------------------------------------------------------------------

type EventType = 'KCU' | 'SUNDAY' | 'WEDNESDAY' | 'SPECIAL';

const EVENT_LABELS: Record<EventType, string> = {
  KCU:       'Weekly KCU Meeting',
  SUNDAY:    'Sunday Attendance',
  WEDNESDAY: 'Wednesday Attendance',
  SPECIAL:   'Special Events',
};

function AttendanceOverview({ assignedZoneId }: { assignedZoneId: string | null }) {
  const [report, setReport]   = useState<ZoneReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [period, setPeriod]   = useState<'WEEKLY' | 'MONTHLY'>('WEEKLY');
  const [eventFilter, setEventFilter] = useState<EventType>('KCU');

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const zoneParam = assignedZoneId ? `&zoneId=${assignedZoneId}` : '';
    api.get(`/api/attendance/report?period=${period}${zoneParam}`)
      .catch(() => null)
      .then((res) => {
        if (res) {
          setReport({
            ...res.data,
            kcuBreakdown: Array.isArray(res.data.kcuBreakdown) ? res.data.kcuBreakdown : [],
          });
        } else {
          setReport({
            zoneId: assignedZoneId ?? 'unknown',
            zoneName: 'Your Zone',
            totalMembers: 0,
            presentCount: 0,
            attendanceRate: 0,
            kcuBreakdown: [],
          });
        }
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load report'))
      .finally(() => setLoading(false));
  }, [assignedZoneId, period]);

  useEffect(() => { load(); }, [load]);

  const breakdown = Array.isArray(report?.kcuBreakdown) ? report!.kcuBreakdown : [];
  const submitted = breakdown.filter((k) => k.submittedAt !== null);
  const overdue   = breakdown.filter((k) => k.submittedAt === null);
  const overallRate = report?.attendanceRate ?? 0;

  return (
    <div className="space-y-4">
      {/* Header controls */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="font-serif text-[15px] font-normal text-gray-800">Attendance Overview</h2>
          <p className="text-[11px] text-gray-400 mt-0.5">Submission status and aggregate metrics across all KCUs</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Event type filter */}
          <select value={eventFilter} onChange={(e) => setEventFilter(e.target.value as EventType)}
            className="text-xs border border-gray-200 rounded-md px-2 py-1.5 text-gray-600 bg-white cursor-pointer focus:outline-none focus:border-primary">
            {(Object.keys(EVENT_LABELS) as EventType[]).map((k) => (
              <option key={k} value={k}>{EVENT_LABELS[k]}</option>
            ))}
          </select>
          {/* Period toggle */}
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
            {(['WEEKLY', 'MONTHLY'] as const).map((p) => (
              <button key={p} onClick={() => setPeriod(p)}
                className={[
                  'px-3 py-1 rounded-md text-xs transition-all cursor-pointer',
                  period === p
                    ? 'bg-white text-gray-800 font-medium shadow-[0_0_0_0.5px_rgba(0,0,0,0.12)]'
                    : 'text-gray-500 hover:text-gray-700',
                ].join(' ')}>
                {p === 'WEEKLY' ? 'This Week' : 'This Month'}
              </button>
            ))}
          </div>
          <RefreshBtn onClick={load} />
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-danger-light border border-danger/20 rounded-xl px-4 py-3 text-[12px] text-danger">
          {error} — Check that the backend is running on port 8080.
        </div>
      )}

      {/* Summary KPI cards */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total Members',   value: loading ? '—' : (report?.totalMembers ?? 0),  accent: 'bg-primary-light', color: 'text-primary' },
          { label: 'Present',         value: loading ? '—' : (report?.presentCount ?? 0),   accent: 'bg-success-light', color: 'text-success' },
          { label: 'Attendance Rate', value: loading ? '—' : `${overallRate}%`,             accent: 'bg-gold-light',    color: 'text-gold'    },
          { label: 'KCUs Submitted',  value: loading ? '—' : `${submitted.length}/${breakdown.length}`, accent: 'bg-primary-light', color: 'text-primary' },
        ].map(({ label, value, accent, color }) => (
          <div key={label} className="bg-white border border-gray-200/80 rounded-xl p-4">
            <div className={`w-8 h-8 ${accent} rounded-lg flex items-center justify-center mb-2.5`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={`w-4 h-4 ${color}`}>
                <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
              </svg>
            </div>
            <p className="text-[11px] text-gray-400 mb-1">{label}</p>
            <p className="text-2xl font-medium text-gray-800 leading-none">{value}</p>
          </div>
        ))}
      </div>

      {/* Overall rate bar */}
      {!loading && report && (
        <div className="bg-white border border-gray-200/80 rounded-xl px-4 py-3.5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] font-medium text-gray-700">
              Overall Zone Rate — {EVENT_LABELS[eventFilter]}
            </span>
            <span className={`text-[12px] font-semibold ${rateColor(overallRate)}`}>{overallRate}%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${rateBarColor(overallRate)} transition-all duration-500`}
              style={{ width: `${overallRate}%` }} />
          </div>
        </div>
      )}

      {/* KCU submission status table */}
      <div className="bg-white border border-gray-200/80 rounded-xl overflow-hidden">
        <div className="px-4 py-3.5 border-b border-gray-100">
          <h3 className="font-serif text-[14px] font-normal text-gray-800">KCU Submission Status</h3>
          <p className="text-[11px] text-gray-400 mt-0.5">
            {submitted.length} submitted · {overdue.length} pending submission
          </p>
        </div>

        {loading && <EmptyState message="Loading attendance data…" />}
        {!loading && breakdown.length === 0 && (
          <EmptyState message="No attendance data for this period."
            sub="Data appears once KCU leaders submit their records." />
        )}

        {!loading && breakdown.length > 0 && (
          <>
            <div className="grid grid-cols-[1fr_90px_70px_70px_130px_90px_90px] gap-3 px-4 py-2 bg-gray-50/60 border-b border-gray-100">
              {['KCU / Leader', 'Members', 'Present', 'Absent', 'Rate', 'Submitted', 'Status'].map((h) => (
                <span key={h} className="text-[10px] text-gray-400 uppercase tracking-[0.07em] font-medium">{h}</span>
              ))}
            </div>
            <div className="divide-y divide-gray-100">
              {Array.isArray(breakdown) ? breakdown.map((kcu) => {
                const submitted = kcu.submittedAt !== null;
                return (
                  <div key={kcu.kcuId}
                    className="grid grid-cols-[1fr_90px_70px_70px_130px_90px_90px] gap-3 px-4 py-3 items-center hover:bg-gray-50/50 transition-colors">
                    <div>
                      <p className="text-[12.5px] font-medium text-gray-800">{kcu.kcuName}</p>
                      <p className="text-[11px] text-gray-400">{kcu.leaderName}</p>
                    </div>
                    <span className="text-[12px] text-gray-600">{kcu.totalMembers}</span>
                    <span className="text-[12px] text-success">{kcu.presentCount}</span>
                    <span className="text-[12px] text-danger">{kcu.absentCount}</span>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${rateBarColor(kcu.attendanceRate)}`}
                          style={{ width: `${kcu.attendanceRate}%` }} />
                      </div>
                      <span className={`text-[11px] font-medium w-8 text-right ${rateColor(kcu.attendanceRate)}`}>
                        {kcu.attendanceRate}%
                      </span>
                    </div>
                    <span className="text-[11px] text-gray-400">
                      {kcu.submittedAt
                        ? new Date(kcu.submittedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
                        : <span className="text-gray-300 italic">Pending</span>}
                    </span>
                    <span className={[
                      'inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] font-medium',
                      submitted
                        ? kcu.attendanceRate >= 75 ? 'bg-success-light text-success'
                        : kcu.attendanceRate >= 50 ? 'bg-gold-light text-gold'
                        : 'bg-danger-light text-danger'
                        : 'bg-gray-100 text-gray-400',
                    ].join(' ')}>
                      {submitted
                        ? kcu.attendanceRate >= 75 ? 'On Track' : kcu.attendanceRate >= 50 ? 'At Risk' : 'Critical'
                        : 'Not Submitted'}
                    </span>
                  </div>
                );
              }) : null}
            </div>
            <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50/50">
              <p className="text-[11px] text-gray-400">
                {breakdown.filter((k) => k.attendanceRate >= 75).length} on track ·{' '}
                {breakdown.filter((k) => k.attendanceRate < 50 && k.submittedAt).length} critical ·{' '}
                {overdue.length} not yet submitted
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 3 — Follow-Up Alerts & Actions
// ---------------------------------------------------------------------------

function ZoneFollowUpAlerts() {
  const [items, setItems]       = useState<FollowUpDTO[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api.get('/api/followups')
      .catch(() => null)
      .then((res) => setItems(res ? toArray<FollowUpDTO>(res.data) : []))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load follow-ups'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSaved = useCallback((updated: FollowUpDTO) => {
    setItems((prev) =>
      Array.isArray(prev) ? prev.map((i) => i.followupId === updated.followupId ? updated : i) : [],
    );
    setExpanded(null);
  }, []);

  const pending  = Array.isArray(items) ? items.filter((i) => i.status === 'PENDING')  : [];
  const resolved = Array.isArray(items) ? items.filter((i) => i.status === 'RESOLVED') : [];
  const overdueCount = pending.filter((i) => isOverdue(i.createdAt)).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-[15px] font-normal text-gray-800">Follow-Up Alerts</h2>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Escalated care cases across all KCUs in your zone
          </p>
        </div>
        <RefreshBtn onClick={load} />
      </div>

      {/* Summary pills */}
      {!loading && !error && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-gold-light text-gold text-[11px] font-medium rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-gold" />{pending.length} Pending
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-success-light text-success text-[11px] font-medium rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-success" />{resolved.length} Resolved
          </span>
          {overdueCount > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-danger-light text-danger text-[11px] font-medium rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-danger" />{overdueCount} Overdue (&gt;72h)
            </span>
          )}
        </div>
      )}

      {loading && (
        <div className="bg-white border border-gray-200/80 rounded-xl px-4 py-10 text-center text-[12px] text-gray-400">
          Loading follow-up queue…
        </div>
      )}
      {!loading && error && (
        <div className="bg-white border border-gray-200/80 rounded-xl px-4 py-6 text-center">
          <p className="text-[12px] text-danger">{error}</p>
          <p className="text-[11px] text-gray-400 mt-1">Check that the backend is running on port 8080.</p>
        </div>
      )}
      {!loading && !error && items.length === 0 && (
        <div className="bg-white border border-gray-200/80 rounded-xl px-4 py-12 text-center">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
            className="w-8 h-8 text-gray-200 mx-auto mb-3">
            <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
          <p className="text-[12px] text-gray-400">No follow-up cases at this time.</p>
          <p className="text-[11px] text-gray-300 mt-1">
            Cases are auto-generated when members miss 2+ consecutive sessions.
          </p>
        </div>
      )}

      {/* Pending */}
      {!loading && !error && pending.length > 0 && (
        <div className="bg-white border border-gray-200/80 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gold-light/40">
            <p className="text-[11px] font-semibold text-gold uppercase tracking-[0.08em]">
              Pending — Zone Leader Action Required
            </p>
          </div>
          <div className="divide-y divide-gray-100">
            {Array.isArray(pending) ? pending.map((item) => (
              <div key={item.followupId} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[12.5px] font-medium text-gray-800">{item.memberName}</p>
                      {isOverdue(item.createdAt) && (
                        <span className="inline-flex px-1.5 py-0.5 bg-danger-light text-danger text-[9px] font-semibold rounded uppercase tracking-wide">
                          Overdue
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {item.memberPhone} · <span className="font-medium">{item.kcuName}</span>
                    </p>
                    <p className="text-[11px] text-gray-500 mt-1">
                      <span className="font-medium">Reason:</span> {item.reason}
                    </p>
                    {item.assignedToName && (
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        KCU Leader: {item.assignedToName}
                      </p>
                    )}
                    {item.notes && (
                      <p className="text-[11px] text-gray-400 mt-0.5 italic">"{item.notes}"</p>
                    )}
                    <p className="text-[10.5px] text-gray-300 mt-1">{timeAgo(item.createdAt)}</p>
                  </div>
                  <button
                    onClick={() => setExpanded(expanded === item.followupId ? null : item.followupId)}
                    className={[
                      'shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-md border transition-colors cursor-pointer',
                      expanded === item.followupId
                        ? 'bg-gray-100 border-gray-200 text-gray-600'
                        : 'bg-primary-light border-primary/20 text-primary hover:bg-primary/10',
                    ].join(' ')}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3 h-3">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                    {expanded === item.followupId ? 'Close' : 'Update'}
                  </button>
                </div>
                {expanded === item.followupId && (
                  <FollowUpUpdateForm item={item} onSaved={handleSaved} onCancel={() => setExpanded(null)} />
                )}
              </div>
            )) : null}
          </div>
        </div>
      )}

      {/* Resolved */}
      {!loading && !error && resolved.length > 0 && (
        <div className="bg-white border border-gray-200/80 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-success-light/40">
            <p className="text-[11px] font-semibold text-success uppercase tracking-[0.08em]">Resolved</p>
          </div>
          <div className="divide-y divide-gray-100">
            {Array.isArray(resolved) ? resolved.map((item) => (
              <div key={item.followupId}
                className="px-4 py-3 flex items-start justify-between gap-3 opacity-70">
                <div className="flex-1 min-w-0">
                  <p className="text-[12.5px] font-medium text-gray-700">{item.memberName}</p>
                  <p className="text-[11px] text-gray-400">
                    {item.memberPhone} · <span className="font-medium">{item.kcuName}</span>
                  </p>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    <span className="font-medium">Reason:</span> {item.reason}
                  </p>
                  {item.notes && (
                    <p className="text-[11px] text-gray-400 mt-0.5 italic">"{item.notes}"</p>
                  )}
                  <p className="text-[10.5px] text-gray-300 mt-1">{timeAgo(item.createdAt)}</p>
                </div>
                <span className="shrink-0 inline-flex px-2 py-0.5 bg-success-light text-success text-[10px] font-medium rounded-full">
                  Resolved
                </span>
              </div>
            )) : null}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 4 — Zone Reports & Analytics
// ---------------------------------------------------------------------------

function ZoneReportsAnalytics({ assignedZoneId }: { assignedZoneId: string | null }) {
  const [report, setReport]   = useState<ZoneReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const zoneParam = assignedZoneId ? `&zoneId=${assignedZoneId}` : '';
    api.get(`/api/attendance/report?period=MONTHLY${zoneParam}`)
      .catch(() => null)
      .then((res) => {
        if (res) {
          setReport({
            ...res.data,
            kcuBreakdown: Array.isArray(res.data.kcuBreakdown) ? res.data.kcuBreakdown : [],
          });
        } else {
          setReport(null);
        }
      })
      .finally(() => setLoading(false));
  }, [assignedZoneId]);

  const breakdown = Array.isArray(report?.kcuBreakdown) ? report!.kcuBreakdown : [];

  // Derived trend buckets
  const onTrack  = breakdown.filter((k) => k.attendanceRate >= 75);
  const atRisk   = breakdown.filter((k) => k.attendanceRate >= 50 && k.attendanceRate < 75);
  const critical = breakdown.filter((k) => k.attendanceRate < 50);

  // Highest and lowest performing KCUs
  const sorted = useMemo(() =>
    [...breakdown].sort((a, b) => b.attendanceRate - a.attendanceRate),
  [breakdown]);

  const exportPlaceholder = (label: string) => (
    <button
      onClick={() => alert(`Export ${label} — backend export endpoint not yet implemented.`)}
      className="flex items-center gap-2 px-4 py-2 text-[12px] font-medium border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors cursor-pointer"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4 text-gray-400">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      {label}
    </button>
  );

  return (
    <div className="space-y-5">
      {/* Header + export actions */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-serif text-[15px] font-normal text-gray-800">Reports & Analytics</h2>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Monthly performance trends — scoped to your zone
          </p>
        </div>
        <div className="flex items-center gap-2">
          {exportPlaceholder('Export PDF')}
          {exportPlaceholder('Export CSV')}
        </div>
      </div>

      {loading && (
        <div className="bg-white border border-gray-200/80 rounded-xl px-4 py-10 text-center text-[12px] text-gray-400">
          Loading analytics…
        </div>
      )}

      {!loading && (
        <>
          {/* Performance distribution */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'On Track (≥75%)',  count: onTrack.length,  accent: 'bg-success-light', color: 'text-success',  bar: 'bg-success'  },
              { label: 'At Risk (50–74%)', count: atRisk.length,   accent: 'bg-gold-light',    color: 'text-gold',    bar: 'bg-gold'     },
              { label: 'Critical (<50%)',  count: critical.length, accent: 'bg-danger-light',  color: 'text-danger',  bar: 'bg-danger'   },
            ].map(({ label, count, accent, color }) => (
              <div key={label} className="bg-white border border-gray-200/80 rounded-xl p-4">
                <div className={`w-8 h-8 ${accent} rounded-lg flex items-center justify-center mb-2.5`}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={`w-4 h-4 ${color}`}>
                    <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
                  </svg>
                </div>
                <p className="text-[11px] text-gray-400 mb-1">{label}</p>
                <p className="text-2xl font-medium text-gray-800 leading-none">{count}</p>
                <p className="text-[11px] text-gray-400 mt-1">
                  {breakdown.length > 0 ? `${Math.round((count / breakdown.length) * 100)}% of KCUs` : '—'}
                </p>
              </div>
            ))}
          </div>

          {/* KCU performance bar chart (tabular) */}
          <div className="bg-white border border-gray-200/80 rounded-xl overflow-hidden">
            <div className="px-4 py-3.5 border-b border-gray-100">
              <h3 className="font-serif text-[14px] font-normal text-gray-800">KCU Performance Ranking</h3>
              <p className="text-[11px] text-gray-400 mt-0.5">Monthly attendance rate — highest to lowest</p>
            </div>

            {breakdown.length === 0 ? (
              <EmptyState message="No performance data available."
                sub="Data populates once KCU leaders submit attendance records." />
            ) : (
              <>
                <div className="divide-y divide-gray-100">
                  {Array.isArray(sorted) ? sorted.map((kcu, idx) => (
                    <div key={kcu.kcuId}
                      className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50/50 transition-colors">
                      {/* Rank */}
                      <span className="text-[11px] text-gray-300 font-mono w-5 shrink-0 text-right">
                        {idx + 1}
                      </span>
                      {/* KCU name */}
                      <div className="w-44 shrink-0 min-w-0">
                        <p className="text-[12px] font-medium text-gray-800 truncate">{kcu.kcuName}</p>
                        <p className="text-[10.5px] text-gray-400 truncate">{kcu.leaderName}</p>
                      </div>
                      {/* Bar */}
                      <div className="flex-1 flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${rateBarColor(kcu.attendanceRate)} transition-all duration-500`}
                            style={{ width: `${kcu.attendanceRate}%` }}
                          />
                        </div>
                        <span className={`text-[11px] font-semibold w-10 text-right shrink-0 ${rateColor(kcu.attendanceRate)}`}>
                          {kcu.attendanceRate}%
                        </span>
                      </div>
                      {/* Members */}
                      <span className="text-[11px] text-gray-400 w-20 text-right shrink-0">
                        {kcu.presentCount}/{kcu.totalMembers}
                      </span>
                    </div>
                  )) : null}
                </div>
                <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50/50">
                  <p className="text-[11px] text-gray-400">
                    Zone average: <span className="font-medium">{report?.attendanceRate ?? 0}%</span> ·{' '}
                    Best: <span className="font-medium text-success">{sorted[0]?.kcuName ?? '—'}</span> ·{' '}
                    Needs support: <span className="font-medium text-danger">{sorted[sorted.length - 1]?.kcuName ?? '—'}</span>
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Zone summary card */}
          {report && (
            <div className="bg-white border border-gray-200/80 rounded-xl px-4 py-4">
              <h3 className="font-serif text-[14px] font-normal text-gray-800 mb-3">Zone Summary</h3>
              <div className="grid grid-cols-2 gap-3 text-[12px]">
                {[
                  ['Zone',            report.zoneName],
                  ['Total Members',   String(report.totalMembers)],
                  ['Present (Month)', String(report.presentCount)],
                  ['Attendance Rate', `${report.attendanceRate}%`],
                  ['Active KCUs',     String(breakdown.length)],
                  ['KCUs Submitted',  String(breakdown.filter((k) => k.submittedAt).length)],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
                    <span className="text-gray-500">{label}</span>
                    <span className="font-medium text-gray-800">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Root — tabbed workspace shell
// ---------------------------------------------------------------------------

const TABS: { id: ZoneTab; label: string; icon: React.ReactNode }[] = [
  {
    id: 'directory',
    label: 'KCU Directory',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
        <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
        <line x1="8" y1="2" x2="8" y2="18" /><line x1="16" y1="6" x2="16" y2="22" />
      </svg>
    ),
  },
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
    id: 'followup',
    label: 'Follow-Up',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    ),
  },
  {
    id: 'reports',
    label: 'Reports',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
        <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
  },
];

export default function ZoneAttendanceReport({ initialTab = 'directory' }: { initialTab?: ZoneTab }) {
  const { assignedZoneId } = useAuth();
  const [activeTab, setActiveTab] = useState<ZoneTab>(initialTab);

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div>
        <h1 className="font-serif text-lg font-normal text-gray-800">Zone Leader Workspace</h1>
        <p className="text-[12px] text-gray-400 mt-0.5">
          Manage your zone's KCUs, attendance, follow-ups, and performance reports
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

      {/* Tab content — each sub-component manages its own data fetching */}
      {activeTab === 'directory'  && <KcuDirectory assignedZoneId={assignedZoneId} />}
      {activeTab === 'attendance' && <AttendanceOverview assignedZoneId={assignedZoneId} />}
      {activeTab === 'followup'   && <ZoneFollowUpAlerts />}
      {activeTab === 'reports'    && <ZoneReportsAnalytics assignedZoneId={assignedZoneId} />}
    </div>
  );
}
