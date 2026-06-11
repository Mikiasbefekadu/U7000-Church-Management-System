/**
 * PastorAttendanceAnalytics.tsx
 *
 * High-level attendance analytics page for Pastors.
 * Displays church-wide aggregated metrics, trends, and zone breakdowns.
 *
 * Data is fetched from:
 *   GET /api/attendance/report?period=WEEKLY   (aggregated metrics)
 *   GET /api/members?status=Active&size=1      (total member count via totalElements)
 *
 * Falls back to a graceful empty state when the backend is unavailable.
 */

import { useState, useEffect } from 'react';
import api from '../../services/api';
import { getMembers } from '../../services/memberService';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ZoneMetric {
  zoneId: string;
  zoneName: string;
  totalMembers: number;
  presentCount: number;
  attendanceRate: number;
}

interface ChurchMetrics {
  totalMembers: number;
  presentThisWeek: number;
  attendanceRate: number;
  changeVsLastWeek: number;
  zoneBreakdown: ZoneMetric[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
// Sub-components
// ---------------------------------------------------------------------------

interface KpiCardProps {
  label: string;
  value: string | number;
  sub?: string;
  subPositive?: boolean;
  accent: string;
  icon: React.ReactNode;
}

function KpiCard({ label, value, sub, subPositive, accent, icon }: KpiCardProps) {
  return (
    <div className="bg-white border border-gray-200/80 rounded-xl p-4">
      <div className={`w-8 h-8 ${accent} rounded-lg flex items-center justify-center mb-2.5`}>
        {icon}
      </div>
      <p className="text-[11px] text-gray-400 mb-1.5">{label}</p>
      <p className="text-2xl font-medium text-gray-800 leading-none">{value}</p>
      {sub !== undefined && (
        <p className={`text-[11px] mt-1 ${subPositive === true ? 'text-success' : subPositive === false ? 'text-danger' : 'text-gray-400'}`}>
          {sub}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function PastorAttendanceAnalytics() {
  const [metrics, setMetrics]   = useState<ChurchMetrics | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [period, setPeriod]     = useState<'WEEKLY' | 'MONTHLY'>('WEEKLY');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    // Fetch total active member count + attendance report in parallel.
    // Both calls are individually guarded — a 404 or network error on either
    // resolves to null instead of rejecting the whole Promise.all.
    Promise.all([
      getMembers({ status: 'Active', size: 1 }).catch(() => null),
      api.get<ChurchMetrics>(`/api/attendance/report?period=${period}`).catch(() => null),
    ])
      .then(([memberPage, reportRes]) => {
        if (cancelled) return;

        const totalMembers = memberPage?.totalElements ?? 0;

        if (reportRes) {
          // Ensure zoneBreakdown is always an array even if the API omits it
          setMetrics({
            ...reportRes.data,
            totalMembers,
            zoneBreakdown: Array.isArray(reportRes.data.zoneBreakdown) ? reportRes.data.zoneBreakdown : [],
          });
        } else {
          // Report endpoint unavailable (404 / network) — show empty state
          setMetrics({
            totalMembers,
            presentThisWeek: 0,
            attendanceRate: 0,
            changeVsLastWeek: 0,
            zoneBreakdown: [],
          });
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load analytics');
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [period]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-lg font-normal text-gray-800">Attendance Analytics</h1>
          <p className="text-[12px] text-gray-400 mt-0.5">
            Church-wide attendance metrics and zone performance
          </p>
        </div>

        {/* Period toggle */}
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
          {(['WEEKLY', 'MONTHLY'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={[
                'px-3.5 py-1 rounded-md text-xs transition-all duration-150 cursor-pointer',
                period === p
                  ? 'bg-white text-gray-800 font-medium shadow-[0_0_0_0.5px_rgba(0,0,0,0.12)]'
                  : 'text-gray-500 hover:text-gray-700',
              ].join(' ')}
            >
              {p === 'WEEKLY' ? 'This Week' : 'This Month'}
            </button>
          ))}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-danger-light border border-danger/20 rounded-xl px-4 py-3 text-[12px] text-danger">
          {error} — Check that the Spring Boot backend is running on port 8080.
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-4 gap-3">
        <KpiCard
          label="Total Active Members"
          value={loading ? '—' : (metrics?.totalMembers ?? '—')}
          sub="Church-wide roster"
          accent="bg-primary-light"
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4 text-primary">
              <circle cx="9" cy="7" r="4" /><path d="M2 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2" />
              <path d="M19 8v6M22 11h-6" strokeWidth={2} />
            </svg>
          }
        />
        <KpiCard
          label="Present This Period"
          value={loading ? '—' : (metrics?.presentThisWeek ?? '—')}
          sub={loading || !metrics ? '' : `${metrics.attendanceRate}% attendance rate`}
          subPositive={metrics ? metrics.attendanceRate >= 75 : undefined}
          accent="bg-success-light"
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4 text-success">
              <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
          }
        />
        <KpiCard
          label="Attendance Rate"
          value={loading ? '—' : `${metrics?.attendanceRate ?? 0}%`}
          sub={
            loading || !metrics ? '' :
            metrics.changeVsLastWeek > 0 ? `↑ ${metrics.changeVsLastWeek}% vs last period` :
            metrics.changeVsLastWeek < 0 ? `↓ ${Math.abs(metrics.changeVsLastWeek)}% vs last period` :
            'No change vs last period'
          }
          subPositive={metrics ? metrics.changeVsLastWeek >= 0 : undefined}
          accent="bg-gold-light"
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4 text-gold">
              <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
            </svg>
          }
        />
        <KpiCard
          label="Active Zones"
          value={loading ? '—' : (metrics?.zoneBreakdown.length ?? '—')}
          sub="Reporting this period"
          accent="bg-primary-light"
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4 text-primary">
              <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
              <line x1="8" y1="2" x2="8" y2="18" /><line x1="16" y1="6" x2="16" y2="22" />
            </svg>
          }
        />
      </div>

      {/* Zone breakdown table */}
      <div className="bg-white border border-gray-200/80 rounded-xl">
        <div className="px-4 py-3.5 border-b border-gray-100">
          <h2 className="font-serif text-[15px] font-normal text-gray-800">Zone Performance Breakdown</h2>
          <p className="text-[11px] text-gray-400 mt-0.5">Attendance rates across all zones</p>
        </div>

        {loading && (
          <div className="px-4 py-10 text-center text-[12px] text-gray-400">Loading zone data…</div>
        )}

        {!loading && (!metrics || metrics.zoneBreakdown.length === 0) && (
          <div className="px-4 py-10 text-center">
            <p className="text-[12px] text-gray-400">No zone data available for this period.</p>
            <p className="text-[11px] text-gray-300 mt-1">
              Zone metrics are populated once KCU leaders submit attendance records.
            </p>
          </div>
        )}

        {!loading && metrics && metrics.zoneBreakdown.length > 0 && (
          <div className="divide-y divide-gray-100">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_80px_80px_120px_80px] gap-4 px-4 py-2 bg-gray-50/60">
              {['Zone', 'Members', 'Present', 'Rate', 'Trend'].map((h) => (
                <span key={h} className="text-[10px] text-gray-400 uppercase tracking-[0.08em] font-medium">{h}</span>
              ))}
            </div>

            {metrics.zoneBreakdown.map((zone) => (
              <div
                key={zone.zoneId}
                className="grid grid-cols-[1fr_80px_80px_120px_80px] gap-4 px-4 py-3 items-center hover:bg-gray-50/50 transition-colors"
              >
                {/* Zone name */}
                <div>
                  <p className="text-[12.5px] font-medium text-gray-800">{zone.zoneName}</p>
                  <p className="text-[11px] text-gray-400">{zone.zoneId}</p>
                </div>

                {/* Members */}
                <span className="text-[12.5px] text-gray-600">{zone.totalMembers}</span>

                {/* Present */}
                <span className="text-[12.5px] text-gray-600">{zone.presentCount}</span>

                {/* Rate bar */}
                <div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${rateBarColor(zone.attendanceRate)} transition-all duration-300`}
                        style={{ width: `${zone.attendanceRate}%` }}
                      />
                    </div>
                    <span className={`text-[11px] font-medium w-8 text-right ${rateColor(zone.attendanceRate)}`}>
                      {zone.attendanceRate}%
                    </span>
                  </div>
                </div>

                {/* Trend badge */}
                <span className={[
                  'inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] font-medium',
                  zone.attendanceRate >= 75 ? 'bg-success-light text-success' :
                  zone.attendanceRate >= 50 ? 'bg-gold-light text-gold' :
                  'bg-danger-light text-danger',
                ].join(' ')}>
                  {zone.attendanceRate >= 75 ? 'On Track' : zone.attendanceRate >= 50 ? 'At Risk' : 'Critical'}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Footer summary */}
        {!loading && metrics && metrics.zoneBreakdown.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/50">
            <p className="text-[11px] text-gray-400">
              {metrics.zoneBreakdown.filter((z) => z.attendanceRate >= 75).length} zones on track ·{' '}
              {metrics.zoneBreakdown.filter((z) => z.attendanceRate < 50).length} zones critical
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
