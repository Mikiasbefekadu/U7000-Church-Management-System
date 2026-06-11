/**
 * ZoneDashboard.tsx
 *
 * Zone Leader summary dashboard — shown when "Dashboard" is selected in the sidebar.
 * Distinct from the Attendance tab (which shows the full searchable report).
 *
 * Sections:
 *   1. Four zone-wide KPI cards  — Total KCUs, Total Members, Pending Follow-ups, Avg Attendance Rate
 *   2. Zone Health Overview       — horizontal bar chart comparing attendance % per KCU
 *   3. KCU Quick Reference        — compact list of KCUs with leader and meeting info
 *
 * All data is read-only — no Add / Edit / Delete actions for this role.
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface KcuRecord {
  kcuId: string | number;
  kcuName: string;
  kcuLeader: string | null;
  meetingDay: string | null;
  meetingTime: string | null;
  location: string | null;
}

interface KcuMetric {
  kcuId: string | number;
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

// ---------------------------------------------------------------------------
// Metric Card atom
// ---------------------------------------------------------------------------

function MetricCard({ label, value, sub, accent, iconPath, iconColor }: {
  label: string; value: string | number; sub?: string;
  accent: string; iconPath: string; iconColor: string;
}) {
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
// Zone Health Bar Chart
// ---------------------------------------------------------------------------

function ZoneHealthChart({ breakdown, loading }: { breakdown: KcuMetric[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="space-y-3 px-4 py-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (breakdown.length === 0) {
    return (
      <div className="px-4 py-10 text-center">
        <p className="text-[12px] text-gray-400">No attendance data available yet.</p>
        <p className="text-[11px] text-gray-300 mt-1">Data appears once KCU leaders submit records.</p>
      </div>
    );
  }

  // Sort by attendance rate descending
  const sorted = [...breakdown].sort((a, b) => b.attendanceRate - a.attendanceRate);

  return (
    <div className="px-4 py-4 space-y-3">
      {sorted.map((kcu) => (
        <div key={String(kcu.kcuId)}>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[12px] font-medium text-gray-700 truncate max-w-[200px]">
                {kcu.kcuName}
              </span>
              {kcu.submittedAt === null && (
                <span className="text-[9.5px] text-gray-400 italic shrink-0">not submitted</span>
              )}
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-[11px] text-gray-400">
                {kcu.presentCount}/{kcu.totalMembers}
              </span>
              <span className={`text-[12px] font-semibold w-10 text-right ${rateColor(kcu.attendanceRate)}`}>
                {kcu.attendanceRate}%
              </span>
            </div>
          </div>
          {/* Bar */}
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${rateBarColor(kcu.attendanceRate)}`}
              style={{ width: `${kcu.attendanceRate}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ZoneDashboard() {
  const { assignedZoneId, fullName } = useAuth();

  const [kcus,     setKcus]     = useState<KcuRecord[]>([]);
  const [report,   setReport]   = useState<ZoneReport | null>(null);
  const [loading,  setLoading]  = useState(true);

  const load = useCallback(() => {
    setLoading(true);

    const kcuUrl    = assignedZoneId ? `/api/kcus?zoneId=${assignedZoneId}` : '/api/kcus';
    const reportUrl = `/api/attendance/report?period=WEEKLY${assignedZoneId ? `&zoneId=${assignedZoneId}` : ''}`;

    Promise.all([
      api.get(kcuUrl).catch(() => null),
      api.get(reportUrl).catch(() => null),
    ]).then(([kcuRes, reportRes]) => {
      if (kcuRes)    setKcus(toArray<KcuRecord>(kcuRes.data));
      if (reportRes) setReport({
        ...reportRes.data,
        kcuBreakdown: Array.isArray(reportRes.data.kcuBreakdown)
          ? reportRes.data.kcuBreakdown
          : [],
      });
    }).finally(() => setLoading(false));
  }, [assignedZoneId]);

  useEffect(() => { load(); }, [load]);

  const breakdown   = report?.kcuBreakdown ?? [];
  const totalKcus   = kcus.length;
  const totalMembers = report?.totalMembers ?? 0;
  const avgRate     = breakdown.length > 0
    ? Math.round(breakdown.reduce((s, k) => s + k.attendanceRate, 0) / breakdown.length)
    : 0;
  const submitted   = breakdown.filter((k) => k.submittedAt !== null).length;
  const overdue     = breakdown.filter((k) => k.submittedAt === null).length;

  return (
    <div className="space-y-5">
      {/* Welcome heading */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-lg font-normal text-gray-800">
            Zone Overview — {fullName?.split(' ')[0] ?? 'Leader'}
          </h1>
          <p className="text-[12px] text-gray-400 mt-0.5">
            Health summary across all cell groups in your zone
          </p>
        </div>
        <button
          onClick={load}
          className="text-[11px] text-gray-400 hover:text-gray-700 flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-3.5 h-3.5">
            <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* ── KPI Cards ── */}
      {loading ? (
        <div className="grid grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white border border-gray-200/80 rounded-xl p-4 h-28 bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-3">
          <MetricCard
            label="Total KCUs"
            value={totalKcus}
            sub="Cell groups in your zone"
            accent="bg-primary-light" iconColor="text-primary"
            iconPath="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10"
          />
          <MetricCard
            label="Total Members"
            value={totalMembers}
            sub="Across all KCUs"
            accent="bg-success-light" iconColor="text-success"
            iconPath="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"
          />
          <MetricCard
            label="Avg Attendance Rate"
            value={`${avgRate}%`}
            sub={`${submitted} of ${breakdown.length} submitted`}
            accent="bg-gold-light" iconColor="text-gold"
            iconPath="M18 20V10 M12 20V4 M6 20v-6"
          />
          <MetricCard
            label="Not Yet Submitted"
            value={overdue}
            sub="KCUs pending this week"
            accent="bg-danger-light" iconColor="text-danger"
            iconPath="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z M12 9v4 M12 17h.01"
          />
        </div>
      )}

      <div className="grid grid-cols-[1fr_320px] gap-4">
        {/* ── Zone Health Bar Chart ── */}
        <div className="bg-white border border-gray-200/80 rounded-xl overflow-hidden">
          <div className="px-4 py-3.5 border-b border-gray-100">
            <h2 className="font-serif text-[14px] font-normal text-gray-800">KCU Attendance Comparison</h2>
            <p className="text-[11px] text-gray-400 mt-0.5">
              This week's attendance rate per cell group — sorted best to worst
            </p>
          </div>
          <ZoneHealthChart breakdown={breakdown} loading={loading} />
          {!loading && breakdown.length > 0 && (
            <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50/50">
              <p className="text-[11px] text-gray-400">
                {breakdown.filter((k) => k.attendanceRate >= 75).length} on track ·{' '}
                {breakdown.filter((k) => k.attendanceRate < 50 && k.submittedAt !== null).length} critical ·{' '}
                {overdue} not submitted
              </p>
            </div>
          )}
        </div>

        {/* ── KCU Quick Reference ── */}
        <div className="bg-white border border-gray-200/80 rounded-xl overflow-hidden">
          <div className="px-4 py-3.5 border-b border-gray-100">
            <h2 className="font-serif text-[14px] font-normal text-gray-800">KCU Directory</h2>
            <p className="text-[11px] text-gray-400 mt-0.5">
              {loading ? 'Loading…' : `${totalKcus} cell groups`}
            </p>
          </div>

          {loading && (
            <div className="px-4 py-10 text-center text-[12px] text-gray-400">Loading…</div>
          )}
          {!loading && kcus.length === 0 && (
            <div className="px-4 py-10 text-center text-[12px] text-gray-400">
              No KCUs found for your zone.
            </div>
          )}
          {!loading && kcus.length > 0 && (
            <div className="divide-y divide-gray-100 max-h-72 overflow-y-auto">
              {kcus.map((kcu) => {
                const metric = breakdown.find((b) => String(b.kcuId) === String(kcu.kcuId));
                return (
                  <div key={String(kcu.kcuId)} className="px-4 py-2.5 flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-primary-light flex items-center justify-center text-[10px] font-semibold text-primary shrink-0">
                      {kcu.kcuName.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-medium text-gray-800 truncate">{kcu.kcuName}</p>
                      <p className="text-[10.5px] text-gray-400 truncate">
                        {kcu.kcuLeader ?? 'No leader'}{kcu.meetingDay ? ` · ${kcu.meetingDay}` : ''}
                      </p>
                    </div>
                    {metric && (
                      <span className={`shrink-0 text-[11px] font-semibold ${rateColor(metric.attendanceRate)}`}>
                        {metric.attendanceRate}%
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
