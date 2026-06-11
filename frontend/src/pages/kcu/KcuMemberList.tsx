/**
 * KcuMemberList.tsx
 *
 * Local member roster for KCU Leaders.
 * Displays only the members bound to this leader's assigned KCU group.
 * Includes a local search filter bar (no extra API call — filters in-memory).
 *
 * Backend contract:
 *   GET /api/members?kcuId=&status=Active&size=100&sort=fullName,asc
 */

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import type { MemberSummary } from '../../services/memberService';

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

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function BaptismBadge({ status }: { status: MemberSummary['baptismStatus'] }) {
  if (!status) return <span className="text-gray-300 text-[11px]">—</span>;
  return (
    <span className={[
      'inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium',
      status === 'Baptized' ? 'bg-success-light text-success' : 'bg-gold-light text-gold',
    ].join(' ')}>
      {status === 'Baptized' ? 'Baptized' : 'Candidate'}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function KcuMemberList() {
  const { assignedKcuId } = useAuth();

  const [members, setMembers] = useState<MemberSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [search, setSearch]   = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({ status: 'Active', size: '100', sort: 'fullName,asc' });
    if (assignedKcuId) params.set('kcuId', assignedKcuId);

    api.get(`/api/members?${params.toString()}`)
      .then((res) => {
        if (cancelled) return;
        setMembers(toArray<MemberSummary>(res.data));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load members');
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [assignedKcuId]);

  // Local search filter — no extra API call
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) =>
      m.fullName.toLowerCase().includes(q) ||
      m.phone.includes(q),
    );
  }, [members, search]);

  return (
    <div className="space-y-4">
      {/* Header + search */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-[15px] font-normal text-gray-800">KCU Member Roster</h2>
          <p className="text-[11px] text-gray-400 mt-0.5">
            {loading ? 'Loading…' : `${filtered.length} of ${members.length} active members`}
          </p>
        </div>

        {/* Search bar */}
        <div className="relative">
          <svg
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
            className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
          >
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or phone…"
            className="pl-8 pr-3 py-1.5 text-[12px] border border-gray-200 rounded-lg bg-white text-gray-700 placeholder-gray-300 focus:outline-none focus:border-primary transition-colors w-56"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 cursor-pointer"
              aria-label="Clear search"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3 h-3">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Table card */}
      <div className="bg-white border border-gray-200/80 rounded-xl overflow-hidden">
        {/* Column headers */}
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-4 px-4 py-2.5 bg-gray-50/60 border-b border-gray-100">
          {['Member', 'Phone', 'Joined', 'Baptism'].map((h) => (
            <span key={h} className="text-[10px] text-gray-400 uppercase tracking-[0.08em] font-medium">{h}</span>
          ))}
        </div>

        {/* States */}
        {loading && (
          <div className="px-4 py-10 text-center text-[12px] text-gray-400">Loading members…</div>
        )}
        {!loading && error && (
          <div className="px-4 py-6 text-center">
            <p className="text-[12px] text-danger">{error}</p>
            <p className="text-[11px] text-gray-400 mt-1">Check that the backend is running on port 8080.</p>
          </div>
        )}
        {!loading && !error && members.length === 0 && (
          <div className="px-4 py-10 text-center text-[12px] text-gray-400">
            No active members found for your KCU group.
          </div>
        )}
        {!loading && !error && members.length > 0 && filtered.length === 0 && (
          <div className="px-4 py-8 text-center text-[12px] text-gray-400">
            No members match "<span className="font-medium">{search}</span>".
          </div>
        )}

        {/* Rows */}
        {!loading && !error && Array.isArray(filtered) && filtered.length > 0 && (
          <div className="divide-y divide-gray-100">
            {filtered.map((member) => (
              <div
                key={member.memberId}
                className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-4 px-4 py-3 items-center hover:bg-gray-50/60 transition-colors"
              >
                {/* Name + avatar */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium shrink-0 ${avatarClass(member.memberId)}`}>
                    {member.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[12.5px] font-medium text-gray-800 truncate">{member.fullName}</p>
                    <p className="text-[10.5px] text-gray-400">{member.memberId}</p>
                  </div>
                </div>

                {/* Phone */}
                <span className="text-[12px] text-gray-600 font-mono">{member.phone}</span>

                {/* Join date — not in MemberSummary, show birthDate as proxy */}
                <span className="text-[12px] text-gray-500">{formatDate(member.birthDate)}</span>

                {/* Baptism */}
                <BaptismBadge status={member.baptismStatus} />
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        {!loading && !error && members.length > 0 && (
          <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50/50">
            <p className="text-[11px] text-gray-400">
              {members.filter((m) => m.baptismStatus === 'Baptized').length} baptized ·{' '}
              {members.filter((m) => m.baptismStatus === 'Candidate').length} candidates ·{' '}
              {members.filter((m) => !m.baptismStatus).length} not recorded
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
