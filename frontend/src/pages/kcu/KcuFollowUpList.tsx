/**
 * KcuFollowUpList.tsx
 *
 * Spiritual follow-up queue for KCU Leaders.
 * Lists members flagged for follow-up (missed consecutive meetings).
 * Provides an inline action form to log care notes and resolve cases.
 *
 * Backend contract:
 *   GET   /api/followups                    → PENDING worklist (RBAC-scoped)
 *   PATCH /api/followups/{followupId}       → { status, notes }
 */

import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';

// ---------------------------------------------------------------------------
// Types — mirror FollowUpDTO.java exactly
// ---------------------------------------------------------------------------

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
  createdAt: string; // ISO-8601 timestamp
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

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1)  return 'Just now';
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function isOverdue(iso: string): boolean {
  return Date.now() - new Date(iso).getTime() > 72 * 3_600_000;
}

// ---------------------------------------------------------------------------
// Inline update form
// ---------------------------------------------------------------------------

interface UpdateFormProps {
  item: FollowUpDTO;
  onSaved: (updated: FollowUpDTO) => void;
  onCancel: () => void;
}

function UpdateForm({ item, onSaved, onCancel }: UpdateFormProps) {
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
      {/* Status toggle */}
      <div>
        <p className="text-[10.5px] font-medium text-gray-500 mb-1.5 uppercase tracking-[0.07em]">Update Status</p>
        <div className="flex gap-2">
          {(['PENDING', 'RESOLVED'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={[
                'px-3 py-1 rounded-full text-[11px] font-medium transition-colors cursor-pointer',
                status === s
                  ? s === 'RESOLVED'
                    ? 'bg-success text-white'
                    : 'bg-gold text-white'
                  : 'bg-white border border-gray-200 text-gray-500 hover:border-gray-300',
              ].join(' ')}
            >
              {s === 'PENDING' ? 'Keep Pending' : 'Mark Resolved'}
            </button>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div>
        <p className="text-[10.5px] font-medium text-gray-500 mb-1.5 uppercase tracking-[0.07em]">Care Notes</p>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Log a prayer request, home visit outcome, phone call result…"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[12px] text-gray-800 bg-white placeholder-gray-300 focus:outline-none focus:border-primary transition-colors resize-none"
        />
      </div>

      {/* Error */}
      {error && (
        <p className="text-[11px] text-danger">✗ {error}</p>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-2">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-[11.5px] text-gray-500 border border-gray-200 rounded-md hover:bg-gray-100 transition-colors cursor-pointer"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-3.5 py-1.5 bg-sidebar text-white text-[11.5px] font-medium rounded-md hover:bg-sidebar-hover transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
        >
          {saving ? (
            <>
              <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
              </svg>
              Saving…
            </>
          ) : 'Save Update'}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function KcuFollowUpList() {
  const [items, setItems]     = useState<FollowUpDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api.get('/api/followups')
      .then((res) => setItems(toArray<FollowUpDTO>(res.data)))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load follow-ups'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSaved = useCallback((updated: FollowUpDTO) => {
    setItems((prev) =>
      Array.isArray(prev)
        ? prev.map((i) => i.followupId === updated.followupId ? updated : i)
        : [],
    );
    setExpanded(null);
  }, []);

  const pending  = Array.isArray(items) ? items.filter((i) => i.status === 'PENDING') : [];
  const resolved = Array.isArray(items) ? items.filter((i) => i.status === 'RESOLVED') : [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-[15px] font-normal text-gray-800">Spiritual Follow-Up Queue</h2>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Members flagged for pastoral care and follow-up
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

      {/* Summary pills */}
      {!loading && !error && (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-gold-light text-gold text-[11px] font-medium rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-gold" />
            {pending.length} Pending
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-success-light text-success text-[11px] font-medium rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-success" />
            {resolved.length} Resolved
          </span>
          {pending.filter((i) => isOverdue(i.createdAt)).length > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-danger-light text-danger text-[11px] font-medium rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-danger" />
              {pending.filter((i) => isOverdue(i.createdAt)).length} Overdue (&gt;72h)
            </span>
          )}
        </div>
      )}

      {/* States */}
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
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-8 h-8 text-gray-200 mx-auto mb-3">
            <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
          <p className="text-[12px] text-gray-400">No follow-up cases at this time.</p>
          <p className="text-[11px] text-gray-300 mt-1">Cases are generated automatically when members miss 2+ consecutive sessions.</p>
        </div>
      )}

      {/* Pending cases */}
      {!loading && !error && pending.length > 0 && (
        <div className="bg-white border border-gray-200/80 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gold-light/40">
            <p className="text-[11px] font-semibold text-gold uppercase tracking-[0.08em]">
              Pending — Action Required
            </p>
          </div>
          <div className="divide-y divide-gray-100">
            {Array.isArray(pending) ? pending.map((item) => (
              <div key={item.followupId} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  {/* Member info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[12.5px] font-medium text-gray-800">{item.memberName}</p>
                      {isOverdue(item.createdAt) && (
                        <span className="inline-flex px-1.5 py-0.5 bg-danger-light text-danger text-[9px] font-semibold rounded uppercase tracking-wide">
                          Overdue
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-400 mt-0.5">{item.memberPhone} · {item.kcuName}</p>
                    <p className="text-[11px] text-gray-500 mt-1">
                      <span className="font-medium">Reason:</span> {item.reason}
                    </p>
                    {item.notes && (
                      <p className="text-[11px] text-gray-400 mt-0.5 italic">"{item.notes}"</p>
                    )}
                    <p className="text-[10.5px] text-gray-300 mt-1">{timeAgo(item.createdAt)}</p>
                  </div>

                  {/* Action button */}
                  <button
                    onClick={() => setExpanded(expanded === item.followupId ? null : item.followupId)}
                    className={[
                      'shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-md border transition-colors cursor-pointer',
                      expanded === item.followupId
                        ? 'bg-gray-100 border-gray-200 text-gray-600'
                        : 'bg-primary-light border-primary/20 text-primary hover:bg-primary/10',
                    ].join(' ')}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3 h-3">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                    {expanded === item.followupId ? 'Close' : 'Update'}
                  </button>
                </div>

                {/* Inline update form */}
                {expanded === item.followupId && (
                  <UpdateForm
                    item={item}
                    onSaved={handleSaved}
                    onCancel={() => setExpanded(null)}
                  />
                )}
              </div>
            )) : null}
          </div>
        </div>
      )}

      {/* Resolved cases */}
      {!loading && !error && resolved.length > 0 && (
        <div className="bg-white border border-gray-200/80 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-success-light/40">
            <p className="text-[11px] font-semibold text-success uppercase tracking-[0.08em]">
              Resolved
            </p>
          </div>
          <div className="divide-y divide-gray-100">
            {Array.isArray(resolved) ? resolved.map((item) => (
              <div key={item.followupId} className="px-4 py-3 flex items-start justify-between gap-3 opacity-70">
                <div className="flex-1 min-w-0">
                  <p className="text-[12.5px] font-medium text-gray-700">{item.memberName}</p>
                  <p className="text-[11px] text-gray-400">{item.memberPhone} · {item.kcuName}</p>
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
