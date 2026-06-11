/**
 * KcuDashboard.tsx
 *
 * KCU Leader summary dashboard — shown when "Dashboard" is selected in the sidebar.
 * Intentionally distinct from the Attendance tab (which shows the mark-attendance grid).
 *
 * Sections:
 *   1. Four metric cards  — Total Members, Baptized, Pending Follow-ups, Attendance Rate
 *   2. Recent Follow-ups  — latest 5 PENDING care cases for this KCU
 *   3. Member Snapshot    — top-5 roster preview (name, phone, baptism status)
 *
 * All data is read-only — no Add / Edit / Delete actions for this role.
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import type { MemberSummary } from '../../services/memberService';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toArray<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>;
    if (Array.isArray(d.content)) return d.content as T[];
  }
  return [];
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return 'Just now';
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FollowUpDTO {
  followupId: string;
  memberId: string;
  memberName: string;
  memberPhone: string;
  reason: string;
  status: 'PENDING' | 'RESOLVED';
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Metric Card atom
// ---------------------------------------------------------------------------

interface MetricCardProps {
  label: string;
  value: string | number;
  sub?: string;
  accent: string;
  iconPath: string;
  iconColor: string;
}

function MetricCard({ label, value, sub, accent, iconPath, iconColor }: MetricCardProps) {
  return (
    <div className="bg-white border border-gray-200/80 rounded-xl p-4 flex flex-col gap-2">
      <div className={`w-9 h-9 ${accent} rounded-lg flex items-center justify-center`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
          className={`w-[18px] h-[18px] ${iconColor}`}>
          <path d={iconPath} />
        </svg>
      </div>
      <div>
        <p className="text-[11px] text-gray-400">{label}</p>
        <p className="text-2xl font-medium text-gray-800 leading-tight">{value}</p>
        {sub && <p className="text-[10.5px] text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function KcuDashboard() {
  const { assignedKcuId, fullName } = useAuth();

  const [members,   setMembers]   = useState<MemberSummary[]>([]);
  const [followups, setFollowups] = useState<FollowUpDTO[]>([]);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ status: 'Active', size: '100', sort: 'fullName,asc' });
    if (assignedKcuId) params.set('kcuId', assignedKcuId);

    Promise.all([
      api.get(`/api/members?${params.toString()}`).catch(() => null),
      api.get('/api/followups').catch(() => null),
    ]).then(([membersRes, followupsRes]) => {
      if (membersRes) setMembers(toArray<MemberSummary>(membersRes.data));
      if (followupsRes) {
        const all = toArray<FollowUpDTO>(followupsRes.data);
        setFollowups(all.filter((f) => f.status === 'PENDING').slice(0, 5));
      }
    }).finally(() => setLoading(false));
  }, [assignedKcuId]);

  // Derived metrics
  const totalMembers  = members.length;
  const baptized      = members.filter((m) => m.baptismStatus === 'Baptized').length;
  const candidates    = members.filter((m) => m.baptismStatus === 'Candidate').length;
  const pendingCare   = followups.length;
  const vipCompleted  = members.filter((m) => m.vipStatus === 'Completed').length;

  // Top 5 preview
  const preview = members.slice(0, 5);

  return (
    <div className="space-y-5">
      {/* Welcome heading */}
      <div>
        <h1 className="font-serif text-lg font-normal text-gray-800">
          Welcome back, {fullName?.split(' ')[0] ?? 'Leader'}
        </h1>
        <p className="text-[12px] text-gray-400 mt-0.5">
          Here's a snapshot of your cell group's current status.
        </p>
      </div>

      {/* ── Metric cards ── */}
      {loading ? (
        <div className="grid grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white border border-gray-200/80 rounded-xl p-4 h-28 animate-pulse bg-gray-100" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-3">
          <MetricCard
            label="Total Members"
            value={totalMembers}
            sub="Active in your KCU"
            accent="bg-primary-light"
            iconColor="text-primary"
            iconPath="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"
          />
          <MetricCard
            label="Baptized"
            value={baptized}
            sub={`${candidates} candidate${candidates !== 1 ? 's' : ''}`}
            accent="bg-success-light"
            iconColor="text-success"
            iconPath="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
          />
          <MetricCard
            label="VIP Completed"
            value={vipCompleted}
            sub={`of ${totalMembers} members`}
            accent="bg-gold-light"
            iconColor="text-gold"
            iconPath="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
          />
          <MetricCard
            label="Pending Follow-ups"
            value={pendingCare}
            sub="Need pastoral care"
            accent="bg-danger-light"
            iconColor="text-danger"
            iconPath="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"
          />
        </div>
      )}

      <div className="grid grid-cols-[1fr_380px] gap-4">
        {/* ── Recent Follow-ups ── */}
        <div className="bg-white border border-gray-200/80 rounded-xl overflow-hidden">
          <div className="px-4 py-3.5 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="font-serif text-[14px] font-normal text-gray-800">Pending Care Cases</h2>
              <p className="text-[11px] text-gray-400 mt-0.5">Members needing follow-up attention</p>
            </div>
            {pendingCare > 0 && (
              <span className="bg-danger-light text-danger text-[11px] font-medium px-2 py-0.5 rounded-full">
                {pendingCare} pending
              </span>
            )}
          </div>

          {loading && (
            <div className="px-4 py-10 text-center text-[12px] text-gray-400">Loading…</div>
          )}
          {!loading && followups.length === 0 && (
            <div className="px-4 py-10 text-center">
              <p className="text-[12px] text-gray-400">No pending follow-up cases.</p>
              <p className="text-[11px] text-gray-300 mt-1">Your cell group is fully up to date.</p>
            </div>
          )}
          {!loading && followups.length > 0 && (
            <div className="divide-y divide-gray-100">
              {followups.map((f) => (
                <div key={f.followupId} className="px-4 py-3 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-danger-light flex items-center justify-center shrink-0 mt-0.5">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4 text-danger">
                      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12.5px] font-medium text-gray-800">{f.memberName}</p>
                    <p className="text-[11px] text-gray-500">{f.reason}</p>
                    <p className="text-[10.5px] text-gray-400 mt-0.5">{f.memberPhone} · {timeAgo(f.createdAt)}</p>
                  </div>
                  <span className="shrink-0 text-[10px] font-medium bg-gold-light text-gold px-2 py-0.5 rounded-full mt-1">
                    PENDING
                  </span>
                </div>
              ))}
            </div>
          )}

          {!loading && followups.length > 0 && (
            <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50/50">
              <p className="text-[11px] text-gray-400">
                Use the Follow-Up tab to update and resolve cases.
              </p>
            </div>
          )}
        </div>

        {/* ── Member Snapshot ── */}
        <div className="bg-white border border-gray-200/80 rounded-xl overflow-hidden">
          <div className="px-4 py-3.5 border-b border-gray-100">
            <h2 className="font-serif text-[14px] font-normal text-gray-800">Member Snapshot</h2>
            <p className="text-[11px] text-gray-400 mt-0.5">
              {totalMembers} active members · top 5 shown
            </p>
          </div>

          {loading && (
            <div className="px-4 py-10 text-center text-[12px] text-gray-400">Loading…</div>
          )}
          {!loading && preview.length === 0 && (
            <div className="px-4 py-10 text-center text-[12px] text-gray-400">
              No members found in your KCU.
            </div>
          )}
          {!loading && preview.length > 0 && (
            <div className="divide-y divide-gray-100">
              {preview.map((m) => (
                <div key={m.memberId} className="px-4 py-2.5 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary-light flex items-center justify-center text-[11px] font-medium text-primary shrink-0">
                    {m.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium text-gray-800 truncate">{m.fullName}</p>
                    <p className="text-[10.5px] text-gray-400 font-mono">{m.phone}</p>
                  </div>
                  <span className={[
                    'text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0',
                    m.baptismStatus === 'Baptized' ? 'bg-success-light text-success'
                    : m.baptismStatus === 'Candidate' ? 'bg-gold-light text-gold'
                    : 'bg-gray-100 text-gray-400',
                  ].join(' ')}>
                    {m.baptismStatus ?? 'Unrecorded'}
                  </span>
                </div>
              ))}
            </div>
          )}

          {!loading && members.length > 5 && (
            <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50/50">
              <p className="text-[11px] text-gray-400">
                +{members.length - 5} more — open Members tab for full roster.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
