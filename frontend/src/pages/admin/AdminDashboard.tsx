/**
 * AdminDashboard.tsx
 *
 * Administrative workspace with two operational modules:
 *   Tab 1 — Member Onboarding Hub   (POST /api/members/register)
 *   Tab 2 — Staff Provisioning Console (GET/POST /api/admin/users,
 *                                       PATCH /api/admin/users/{id}/reset-password)
 *
 * Zones and KCUs are loaded once on mount from:
 *   GET /api/admin/zones
 *   GET /api/admin/kcus
 */

import { useState, useEffect, useCallback, type FormEvent } from 'react';
import api from '../../services/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type OnboardingCategory = 'A' | 'B' | 'C' | 'D';

const CATEGORY_LABELS: Record<OnboardingCategory, string> = {
  A: 'A — First-Time Salvation & Foundations',
  B: 'B — Church Transfer / Protestant Change',
  C: 'C — Child Dedication / Born into Church',
  D: 'D — General Registration',
};

const MINISTRY_OPTIONS = [
  { id: 'MIN_LIGHT_SALT',   label: "Light and Salt Children's Ministry" },
  { id: 'MIN_AV_JODAN',     label: 'AV Jodan (Business, Student & Professional Ministry)' },
  { id: 'MIN_YOUTH',        label: 'Youth Ministry' },
  { id: 'MIN_FAMILY',       label: 'Family Unit Ministry' },
  { id: 'MIN_JUBAL',        label: 'Jubal Rehoboth Worship Ministry' },
  { id: 'MIN_SOCIAL',       label: 'Social Services Ministry (CAF)' },
  { id: 'MIN_BARA',         label: 'Bara Evangelism Ministry' },
  { id: 'MIN_YOUNG_ADULTS', label: 'Young Adults Ministry' },
  { id: 'MIN_DOMINION',     label: 'Dominion Prayer Ministry' },
  { id: 'MIN_NATIONAL',     label: 'National Vision Planting Office' },
  { id: 'MIN_PROPHETIC',    label: 'Prophetic Office' },
  { id: 'MIN_GAIUS',        label: 'Gaius Diaconal Service Ministry' },
];

const ZONE_OPTIONS = [
  { id: 'Z001', name: 'Zone 1' },
  { id: 'Z002', name: 'Zone 2' },
  { id: 'Z003', name: 'Zone 3' },
  { id: 'Z004', name: 'Zone 4' },
];

interface ChildEntry {
  childName: string;
  childDob: string;
  childGender: 'Male' | 'Female' | '';
}

interface MemberForm {
  category: OnboardingCategory;
  fullName: string;
  phone: string;
  gender: 'Male' | 'Female' | '';
  birthDate: string;
  maritalStatus: 'Single' | 'Married' | '';
  spouseName: string;
  children: ChildEntry[];
  salvationDate: string;
  baptismStatus: 'Baptized' | 'Candidate' | '';
  rightHandGiven: 'Yes' | 'No' | '';
  location: string;
  zoneId: string;
  kcuName: string;
  kcuLeaderName: string;
  joinDate: string;
  skills: string;
  ministryIds: string[];
  ministryOther: boolean;
  ministryOtherText: string;
  notes: string;
}

const EMPTY_MEMBER_FORM: MemberForm = {
  category: 'D',
  fullName: '',
  phone: '',
  gender: '',
  birthDate: '',
  maritalStatus: '',
  spouseName: '',
  children: [],
  salvationDate: '',
  baptismStatus: '',
  rightHandGiven: '',
  location: '',
  zoneId: '',
  kcuName: '',
  kcuLeaderName: '',
  joinDate: '',
  skills: '',
  ministryIds: [],
  ministryOther: false,
  ministryOtherText: '',
  notes: '',
};

// Staff provisioning types
type StaffRole = 'ZONE_LEADER' | 'KCU_LEADER';

interface StaffForm {
  userId: string;
  username: string;
  password: string;
  role: StaffRole;
  assignedZoneId: string;
  assignedKcuId: string;
}

const EMPTY_STAFF_FORM: StaffForm = {
  userId: '',
  username: '',
  password: '',
  role: 'KCU_LEADER',
  assignedZoneId: '',
  assignedKcuId: '',
};

interface UserRecord {
  userId: string;
  username: string;
  role: string;
  assignedZone?: { zoneId: string; zoneName: string } | null;
  assignedKcu?: { kcuId: string; kcuName: string } | null;
}

interface KcuRecord {
  kcuId: string;
  kcuName: string;
  zone?: { zoneId: string } | null;
}

/** Safely extract a plain array from either a raw array or a Spring Page wrapper. */
function toArray<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === 'object' && Array.isArray((data as { content?: unknown }).content)) {
    return (data as { content: T[] }).content;
  }
  return [];
}

// ---------------------------------------------------------------------------
// Shared UI primitives
// ---------------------------------------------------------------------------

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-[11.5px] font-medium text-gray-600 mb-1">
      {children}
      {required && <span className="text-danger ml-0.5">*</span>}
    </label>
  );
}

function Input({
  value, onChange, placeholder, type = 'text', disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[12.5px] text-gray-800 bg-white placeholder-gray-300 focus:outline-none focus:border-primary transition-colors disabled:opacity-50 disabled:bg-gray-50"
    />
  );
}

function Select({
  value, onChange, children, disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[12.5px] text-gray-700 bg-white focus:outline-none focus:border-primary transition-colors disabled:opacity-50 disabled:bg-gray-50 cursor-pointer"
    >
      {children}
    </select>
  );
}

function Textarea({
  value, onChange, placeholder, rows = 3,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[12.5px] text-gray-800 bg-white placeholder-gray-300 focus:outline-none focus:border-primary transition-colors resize-none"
    />
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="col-span-full">
      <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.1em] pt-2 pb-1 border-b border-gray-100">
        {children}
      </h3>
    </div>
  );
}

function ResultBanner({ result }: { result: { ok: boolean; message: string } | null }) {
  if (!result) return null;
  return (
    <div className={[
      'flex items-start gap-2 rounded-lg px-3.5 py-2.5 text-[12px] leading-snug',
      result.ok
        ? 'bg-success-light border border-success/20 text-success'
        : 'bg-danger-light border border-danger/20 text-danger',
    ].join(' ')}>
      <span>{result.ok ? '✓' : '✗'}</span>
      <span>{result.message}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 1 — Member Onboarding Hub
// ---------------------------------------------------------------------------

function MemberOnboardingTab({ kcus }: { kcus: KcuRecord[] }) {
  const [form, setForm] = useState<MemberForm>(EMPTY_MEMBER_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const set = useCallback(<K extends keyof MemberForm>(key: K, value: MemberForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setResult(null);
  }, []);

  // Filter KCUs by selected zone
  const safeKcus = Array.isArray(kcus) ? kcus : [];
  const filteredKcus = form.zoneId
    ? safeKcus.filter((k) => k.zone?.zoneId === form.zoneId)
    : safeKcus;

  // Ministry checkbox toggle
  const toggleMinistry = (id: string) => {
    setForm((prev) => ({
      ...prev,
      ministryIds: prev.ministryIds.includes(id)
        ? prev.ministryIds.filter((m) => m !== id)
        : [...prev.ministryIds, id],
    }));
    setResult(null);
  };

  // Children management
  const addChild = () =>
    setForm((prev) => ({
      ...prev,
      children: [...prev.children, { childName: '', childDob: '', childGender: '' }],
    }));

  const updateChild = (idx: number, field: keyof ChildEntry, value: string) =>
    setForm((prev) => {
      const updated = [...prev.children];
      updated[idx] = { ...updated[idx], [field]: value };
      return { ...prev, children: updated };
    });

  const removeChild = (idx: number) =>
    setForm((prev) => ({
      ...prev,
      children: prev.children.filter((_, i) => i !== idx),
    }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.fullName.trim() || !form.phone.trim() || !form.gender) {
      setResult({ ok: false, message: 'Full Name, Phone, and Gender are required.' });
      return;
    }

    setSubmitting(true);
    setResult(null);

    // Build the ministry IDs list (include "other" as a custom entry if filled)
    const ministryIds = [
      ...form.ministryIds,
      ...(form.ministryOther && form.ministryOtherText.trim() ? ['MIN_OTHER'] : []),
    ];

    // Build children array — only include rows with a name
    const children = form.children
      .filter((c) => c.childName.trim())
      .map((c) => ({
        childId: null,
        childName: c.childName.trim(),
        childDob: c.childDob || null,
        childGender: (c.childGender || null) as 'Male' | 'Female' | null,
      }));

    // Generate a provisional memberId (backend may override)
    const memberId = `M${Date.now().toString().slice(-6)}`;

    const payload = {
      memberId,
      fullName: form.fullName.trim(),
      phone: form.phone.trim(),
      gender: form.gender as 'Male' | 'Female',
      birthDate: form.birthDate || null,
      maritalStatus: (form.maritalStatus || null) as 'Single' | 'Married' | null,
      partnerId: null,
      zoneId: form.zoneId || null,
      kcuId: null,                          // KCU is referenced by name in this form
      salvationStatus: form.salvationDate ? 1 : 0,
      salvationDate: form.salvationDate || null,
      baptismStatus: (form.baptismStatus || null) as 'Baptized' | 'Candidate' | null,
      rightHandGiven: (form.rightHandGiven || null) as 'Yes' | 'No' | null,
      vipStatus: 'Not Started' as const,
      children,
      ministryIds,
      competencyIds: [],
      notes: [
        form.notes.trim(),
        form.location.trim() ? `Location: ${form.location.trim()}` : '',
        form.kcuName.trim() ? `KCU: ${form.kcuName.trim()}` : '',
        form.kcuLeaderName.trim() ? `KCU Leader: ${form.kcuLeaderName.trim()}` : '',
        form.skills.trim() ? `Skills/Profession: ${form.skills.trim()}` : '',
        form.spouseName.trim() ? `Spouse: ${form.spouseName.trim()}` : '',
        form.ministryOther && form.ministryOtherText.trim()
          ? `Other Ministry: ${form.ministryOtherText.trim()}` : '',
        `Onboarding Category: ${form.category} — ${CATEGORY_LABELS[form.category]}`,
      ].filter(Boolean).join('\n') || null,
    };

    try {
      await api.post('/api/members/register', payload);
      setResult({ ok: true, message: `Member "${form.fullName}" registered successfully.` });
      setForm(EMPTY_MEMBER_FORM);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed';
      setResult({ ok: false, message: msg });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {/* Onboarding category selector */}
      <div className="bg-primary-light border border-primary/20 rounded-xl px-4 py-3.5">
        <Label>Onboarding Category Type</Label>
        <Select value={form.category} onChange={(v) => set('category', v as OnboardingCategory)}>
          {(Object.keys(CATEGORY_LABELS) as OnboardingCategory[]).map((k) => (
            <option key={k} value={k}>{CATEGORY_LABELS[k]}</option>
          ))}
        </Select>
      </div>

      {/* Form grid */}
      <div className="bg-white border border-gray-200/80 rounded-xl px-5 py-5">
        <div className="grid grid-cols-2 gap-x-5 gap-y-4">

          {/* ── Personal Information ── */}
          <SectionHeading>Personal Information</SectionHeading>

          {/* 1. Full Name */}
          <div>
            <Label required>Full Name</Label>
            <Input value={form.fullName} onChange={(v) => set('fullName', v)} placeholder="e.g. Abebe Girma" />
          </div>

          {/* 2. Phone */}
          <div>
            <Label required>Phone Number</Label>
            <Input value={form.phone} onChange={(v) => set('phone', v)} placeholder="e.g. 0911100001" type="tel" />
          </div>

          {/* 3. Gender */}
          <div>
            <Label required>Gender</Label>
            <Select value={form.gender} onChange={(v) => set('gender', v as MemberForm['gender'])}>
              <option value="">— Select —</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </Select>
          </div>

          {/* 4. Date of Birth */}
          <div>
            <Label>Date of Birth</Label>
            <Input value={form.birthDate} onChange={(v) => set('birthDate', v)} type="date" />
          </div>

          {/* 5. Marital Status */}
          <div>
            <Label>Marital Status</Label>
            <Select value={form.maritalStatus} onChange={(v) => set('maritalStatus', v as MemberForm['maritalStatus'])}>
              <option value="">— Select —</option>
              <option value="Single">Single</option>
              <option value="Married">Married</option>
            </Select>
          </div>

          {/* Spouse Name — conditional */}
          {form.maritalStatus === 'Married' && (
            <div>
              <Label>Spouse Name</Label>
              <Input value={form.spouseName} onChange={(v) => set('spouseName', v)} placeholder="Spouse's full name" />
            </div>
          )}

          {/* Children section — conditional */}
          {form.maritalStatus === 'Married' && (
            <div className="col-span-full">
              <div className="flex items-center justify-between mb-2">
                <Label>Children</Label>
                <button
                  type="button"
                  onClick={addChild}
                  className="text-[11px] text-primary hover:text-primary/80 font-medium cursor-pointer flex items-center gap-1"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Add Child
                </button>
              </div>
              {form.children.length === 0 && (
                <p className="text-[11px] text-gray-300 italic">No children added yet.</p>
              )}
              <div className="space-y-2">
                {form.children.map((child, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_140px_110px_32px] gap-2 items-end">
                    <div>
                      {idx === 0 && <Label>Child Name</Label>}
                      <Input
                        value={child.childName}
                        onChange={(v) => updateChild(idx, 'childName', v)}
                        placeholder="Full name"
                      />
                    </div>
                    <div>
                      {idx === 0 && <Label>Date of Birth</Label>}
                      <Input
                        value={child.childDob}
                        onChange={(v) => updateChild(idx, 'childDob', v)}
                        type="date"
                      />
                    </div>
                    <div>
                      {idx === 0 && <Label>Gender</Label>}
                      <Select
                        value={child.childGender}
                        onChange={(v) => updateChild(idx, 'childGender', v)}
                      >
                        <option value="">— —</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                      </Select>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeChild(idx)}
                      className={`text-gray-300 hover:text-danger transition-colors cursor-pointer ${idx === 0 ? 'mt-5' : ''}`}
                      aria-label="Remove child"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Spiritual Milestones ── */}
          <SectionHeading>Spiritual Milestones</SectionHeading>

          {/* 6. Salvation Date */}
          <div>
            <Label>Salvation Date</Label>
            <Input value={form.salvationDate} onChange={(v) => set('salvationDate', v)} type="date" />
            <p className="text-[10.5px] text-gray-400 mt-1">When did you accept Jesus Christ as your personal savior?</p>
          </div>

          {/* 7. Baptism Status */}
          <div>
            <Label>Baptism Status</Label>
            <Select value={form.baptismStatus} onChange={(v) => set('baptismStatus', v as MemberForm['baptismStatus'])}>
              <option value="">— Select —</option>
              <option value="Baptized">Baptized</option>
              <option value="Candidate">Not Baptized (Candidate)</option>
            </Select>
          </div>

          {/* 8. Right Hand of Fellowship */}
          <div>
            <Label>Right Hand of Fellowship</Label>
            <Select value={form.rightHandGiven} onChange={(v) => set('rightHandGiven', v as MemberForm['rightHandGiven'])}>
              <option value="">— Select —</option>
              <option value="Yes">Yes, Given</option>
              <option value="No">No, Not Given</option>
            </Select>
          </div>

          {/* ── Church Placement ── */}
          <SectionHeading>Church Placement</SectionHeading>

          {/* 9. Residential Location */}
          <div>
            <Label>Residential Location</Label>
            <Input value={form.location} onChange={(v) => set('location', v)} placeholder="Neighbourhood / Area" />
          </div>

          {/* 10. Zone */}
          <div>
            <Label>Zone</Label>
            <Select value={form.zoneId} onChange={(v) => { set('zoneId', v); set('kcuName', ''); }}>
              <option value="">— Select Zone —</option>
              {ZONE_OPTIONS.map((z) => (
                <option key={z.id} value={z.id}>{z.name}</option>
              ))}
            </Select>
          </div>

          {/* 11. KCU Name */}
          <div>
            <Label>KCU Name</Label>
            {Array.isArray(filteredKcus) && filteredKcus.length > 0 ? (
              <Select value={form.kcuName} onChange={(v) => set('kcuName', v)}>
                <option value="">— Select KCU —</option>
                {filteredKcus.map((k) => (
                  <option key={k.kcuId} value={k.kcuName}>{k.kcuName}</option>
                ))}
              </Select>
            ) : (
              <Input value={form.kcuName} onChange={(v) => set('kcuName', v)} placeholder="KCU cell group name" />
            )}
          </div>

          {/* 12. KCU Leader Name */}
          <div>
            <Label>KCU Leader Name</Label>
            <Input value={form.kcuLeaderName} onChange={(v) => set('kcuLeaderName', v)} placeholder="Leader's full name" />
          </div>

          {/* 13. Church Joining Date */}
          <div>
            <Label>Church Joining Date</Label>
            <Input value={form.joinDate} onChange={(v) => set('joinDate', v)} type="date" />
            <p className="text-[10.5px] text-gray-400 mt-1">When did you join The Chosen 7000 Church?</p>
          </div>

          {/* ── Skills & Ministry ── */}
          <SectionHeading>Skills, Profession & Ministry</SectionHeading>

          {/* 14. Skills / Qualifications */}
          <div className="col-span-full">
            <Label>Skills / Qualifications / Profession</Label>
            <Textarea
              value={form.skills}
              onChange={(v) => set('skills', v)}
              placeholder="e.g. Teaching, Law, Media, Health, Technology, Music…"
              rows={2}
            />
          </div>

          {/* 15. Ministry Involvement */}
          <div className="col-span-full">
            <Label>Ministry Involvement</Label>
            <p className="text-[11px] text-gray-400 mb-2.5">Select all ministries this member is involved in or interested in serving:</p>
            <div className="grid grid-cols-2 gap-y-2 gap-x-4">
              {MINISTRY_OPTIONS.map((m) => (
                <label key={m.id} className="flex items-start gap-2 cursor-pointer group">
                  <div
                    onClick={() => toggleMinistry(m.id)}
                    className={[
                      'w-[15px] h-[15px] mt-0.5 rounded border-[1.5px] flex items-center justify-center shrink-0 transition-colors cursor-pointer',
                      form.ministryIds.includes(m.id)
                        ? 'bg-primary border-primary'
                        : 'border-gray-300 bg-white group-hover:border-primary/50',
                    ].join(' ')}
                  >
                    {form.ministryIds.includes(m.id) && (
                      <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} className="w-2.5 h-2.5">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    )}
                  </div>
                  <span
                    onClick={() => toggleMinistry(m.id)}
                    className="text-[12px] text-gray-700 leading-snug select-none"
                  >
                    {m.label}
                  </span>
                </label>
              ))}

              {/* Other */}
              <label className="flex items-start gap-2 cursor-pointer group">
                <div
                  onClick={() => { set('ministryOther', !form.ministryOther); setResult(null); }}
                  className={[
                    'w-[15px] h-[15px] mt-0.5 rounded border-[1.5px] flex items-center justify-center shrink-0 transition-colors cursor-pointer',
                    form.ministryOther
                      ? 'bg-primary border-primary'
                      : 'border-gray-300 bg-white group-hover:border-primary/50',
                  ].join(' ')}
                >
                  {form.ministryOther && (
                    <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} className="w-2.5 h-2.5">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  )}
                </div>
                <span
                  onClick={() => { set('ministryOther', !form.ministryOther); setResult(null); }}
                  className="text-[12px] text-gray-700 leading-snug select-none"
                >
                  Other
                </span>
              </label>
            </div>

            {/* Other ministry text input */}
            {form.ministryOther && (
              <div className="mt-2.5">
                <Input
                  value={form.ministryOtherText}
                  onChange={(v) => set('ministryOtherText', v)}
                  placeholder="Specify other ministry…"
                />
              </div>
            )}
          </div>

          {/* 16. Additional Notes */}
          <div className="col-span-full">
            <Label>Additional Notes</Label>
            <Textarea
              value={form.notes}
              onChange={(v) => set('notes', v)}
              placeholder="Any additional information about this member…"
              rows={3}
            />
          </div>
        </div>
      </div>

      {/* Result banner */}
      <ResultBanner result={result} />

      {/* Submit */}
      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => { setForm(EMPTY_MEMBER_FORM); setResult(null); }}
          className="px-4 py-2 text-[12.5px] text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
        >
          Clear Form
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="px-5 py-2 bg-sidebar text-white text-[12.5px] font-medium rounded-lg hover:bg-sidebar-hover transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {submitting ? (
            <>
              <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
              </svg>
              Registering…
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                <line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" />
              </svg>
              Register Member
            </>
          )}
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Tab 2 — Staff Provisioning Console
// ---------------------------------------------------------------------------

function StaffProvisioningTab({ zones, kcus }: { zones: { zoneId: string; zoneName: string }[]; kcus: KcuRecord[] }) {
  const [form, setForm] = useState<StaffForm>(EMPTY_STAFF_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const [users, setUsers] = useState<UserRecord[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  // Load user roster
  const loadUsers = useCallback(() => {
    setUsersLoading(true);
    setUsersError(null);
    api.get('/api/admin/users')
      .then((res) => setUsers(toArray<UserRecord>(res.data)))
      .catch((err: unknown) => setUsersError(err instanceof Error ? err.message : 'Failed to load users'))
      .finally(() => setUsersLoading(false));
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const set = useCallback(<K extends keyof StaffForm>(key: K, value: StaffForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setResult(null);
  }, []);

  // Filter KCUs by selected zone in the provisioning form
  const safeKcus = Array.isArray(kcus) ? kcus : [];
  const filteredKcus = form.assignedZoneId
    ? safeKcus.filter((k) => k.zone?.zoneId === form.assignedZoneId)
    : safeKcus;

  const handleCreateUser = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.userId.trim() || !form.username.trim() || !form.password.trim()) {
      setResult({ ok: false, message: 'User ID, Username, and Password are required.' });
      return;
    }
    if (form.role === 'ZONE_LEADER' && !form.assignedZoneId) {
      setResult({ ok: false, message: 'A Zone must be assigned for Zone Leader accounts.' });
      return;
    }
    if (form.role === 'KCU_LEADER' && !form.assignedKcuId) {
      setResult({ ok: false, message: 'A KCU must be assigned for KCU Leader accounts.' });
      return;
    }

    setSubmitting(true);
    setResult(null);

    // Build the payload matching the User entity shape the backend expects
    const payload: Record<string, unknown> = {
      userId: form.userId.trim(),
      username: form.username.trim(),
      password: form.password,
      role: form.role,
    };
    if (form.role === 'ZONE_LEADER' && form.assignedZoneId) {
      payload.assignedZone = { zoneId: form.assignedZoneId };
    }
    if (form.role === 'KCU_LEADER' && form.assignedKcuId) {
      payload.assignedKcu = { kcuId: form.assignedKcuId };
    }

    try {
      await api.post('/api/admin/users', payload);
      setResult({ ok: true, message: `Account "${form.username}" created successfully.` });
      setForm(EMPTY_STAFF_FORM);
      loadUsers();
    } catch (err: unknown) {
      setResult({ ok: false, message: err instanceof Error ? err.message : 'Failed to create user' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (userId: string, username: string) => {
    if (!window.confirm(`Deactivate account for "${username}"? This will prevent them from logging in.`)) return;
    setRevoking(userId);
    try {
      // Reset password to a random unguessable string to effectively lock the account
      const lockPassword = `REVOKED_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      await api.patch(`/api/admin/users/${userId}/reset-password`, { newPassword: lockPassword });
      loadUsers();
    } catch (err: unknown) {
      console.error('[AdminDashboard] revoke error:', err);
    } finally {
      setRevoking(null);
    }
  };

  const roleBadge = (role: string) => {
    const map: Record<string, string> = {
      ADMIN:       'bg-danger-light text-danger',
      PASTOR:      'bg-primary-light text-primary',
      ZONE_LEADER: 'bg-gold-light text-gold',
      KCU_LEADER:  'bg-success-light text-success',
    };
    const labels: Record<string, string> = {
      ADMIN: 'Admin', PASTOR: 'Pastor', ZONE_LEADER: 'Zone Leader', KCU_LEADER: 'KCU Leader',
    };
    return (
      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${map[role] ?? 'bg-gray-100 text-gray-500'}`}>
        {labels[role] ?? role}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* ── Create Staff User ── */}
      <div className="bg-white border border-gray-200/80 rounded-xl">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-serif text-[15px] font-normal text-gray-800">Create Staff Account</h2>
          <p className="text-[11px] text-gray-400 mt-0.5">Provision login credentials and assign operational scope</p>
        </div>

        <form onSubmit={handleCreateUser} noValidate className="px-5 py-5">
          <div className="grid grid-cols-2 gap-x-5 gap-y-4">

            <SectionHeading>Account Identity</SectionHeading>

            <div>
              <Label required>User ID</Label>
              <Input value={form.userId} onChange={(v) => set('userId', v)} placeholder="e.g. U010" />
              <p className="text-[10.5px] text-gray-400 mt-1">Unique identifier — format: U + number</p>
            </div>

            <div>
              <Label required>Username</Label>
              <Input value={form.username} onChange={(v) => set('username', v)} placeholder="e.g. zone1leader" />
            </div>

            <div>
              <Label required>Password</Label>
              <Input value={form.password} onChange={(v) => set('password', v)} type="password" placeholder="Minimum 8 characters" />
            </div>

            <div>
              <Label required>Role</Label>
              <Select value={form.role} onChange={(v) => { set('role', v as StaffRole); set('assignedZoneId', ''); set('assignedKcuId', ''); }}>
                <option value="KCU_LEADER">KCU Leader</option>
                <option value="ZONE_LEADER">Zone Leader</option>
              </Select>
            </div>

            <SectionHeading>Operational Scope Assignment</SectionHeading>

            {/* Zone assignment — always shown */}
            <div>
              <Label required={form.role === 'ZONE_LEADER'}>Assigned Zone</Label>
              <Select
                value={form.assignedZoneId}
                onChange={(v) => { set('assignedZoneId', v); set('assignedKcuId', ''); }}
              >
                <option value="">— Select Zone —</option>
                {Array.isArray(zones) && zones.length > 0
                  ? zones.map((z) => <option key={z.zoneId} value={z.zoneId}>{z.zoneName}</option>)
                  : ZONE_OPTIONS.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)
                }
              </Select>
            </div>

            {/* KCU assignment — only for KCU_LEADER */}
            {form.role === 'KCU_LEADER' && (
              <div>
                <Label required>Assigned KCU</Label>
                <Select value={form.assignedKcuId} onChange={(v) => set('assignedKcuId', v)}>
                  <option value="">— Select KCU —</option>
                  {Array.isArray(filteredKcus) ? filteredKcus.map((k) => (
                    <option key={k.kcuId} value={k.kcuId}>{k.kcuName}</option>
                  )) : null}
                </Select>
                {form.assignedZoneId && Array.isArray(filteredKcus) && filteredKcus.length === 0 && (
                  <p className="text-[10.5px] text-gray-400 mt-1">No KCUs found for this zone.</p>
                )}
              </div>
            )}
          </div>

          <div className="mt-5 space-y-3">
            <ResultBanner result={result} />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 bg-sidebar text-white text-[12.5px] font-medium rounded-lg hover:bg-sidebar-hover transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                      <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
                    </svg>
                    Creating…
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                      <line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" />
                    </svg>
                    Create Account
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* ── User Roster ── */}
      <div className="bg-white border border-gray-200/80 rounded-xl">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="font-serif text-[15px] font-normal text-gray-800">Operational User Roster</h2>
            <p className="text-[11px] text-gray-400 mt-0.5">All provisioned system accounts</p>
          </div>
          <button
            onClick={loadUsers}
            className="text-[11px] text-gray-400 hover:text-gray-700 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-3.5 h-3.5">
              <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            Refresh
          </button>
        </div>

        {usersLoading && (
          <div className="px-5 py-10 text-center text-[12px] text-gray-400">Loading accounts…</div>
        )}
        {!usersLoading && usersError && (
          <div className="px-5 py-6 text-center">
            <p className="text-[12px] text-danger">{usersError}</p>
            <p className="text-[11px] text-gray-400 mt-1">Check that the backend is running on port 8080.</p>
          </div>
        )}
        {!usersLoading && !usersError && users.length === 0 && (
          <div className="px-5 py-10 text-center text-[12px] text-gray-400">No user accounts found.</div>
        )}

        {!usersLoading && !usersError && users.length > 0 && (
          <>
            {/* Table header */}
            <div className="grid grid-cols-[60px_1fr_110px_1fr_1fr_120px] gap-3 px-5 py-2 bg-gray-50/60 border-b border-gray-100">
              {['ID', 'Username', 'Role', 'Zone', 'KCU', 'Actions'].map((h) => (
                <span key={h} className="text-[10px] text-gray-400 uppercase tracking-[0.08em] font-medium">{h}</span>
              ))}
            </div>

            <div className="divide-y divide-gray-100">
              {Array.isArray(users) ? users.map((user) => (
                <div
                  key={user.userId}
                  className="grid grid-cols-[60px_1fr_110px_1fr_1fr_120px] gap-3 px-5 py-3 items-center hover:bg-gray-50/50 transition-colors"
                >
                  <span className="text-[11px] text-gray-400 font-mono">{user.userId}</span>
                  <span className="text-[12.5px] font-medium text-gray-800 truncate">{user.username}</span>
                  <span>{roleBadge(user.role)}</span>
                  <span className="text-[12px] text-gray-500 truncate">
                    {user.assignedZone?.zoneName ?? <span className="text-gray-300">—</span>}
                  </span>
                  <span className="text-[12px] text-gray-500 truncate">
                    {user.assignedKcu?.kcuName ?? <span className="text-gray-300">—</span>}
                  </span>
                  <div>
                    {user.role !== 'ADMIN' && user.role !== 'PASTOR' ? (
                      <button
                        onClick={() => handleRevoke(user.userId, user.username)}
                        disabled={revoking === user.userId}
                        className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] text-danger border border-danger/30 bg-danger-light rounded-md hover:bg-danger/10 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {revoking === user.userId ? (
                          <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                            <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3 h-3">
                            <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
                          </svg>
                        )}
                        Revoke
                      </button>
                    ) : (
                      <span className="text-[11px] text-gray-300 italic">Protected</span>
                    )}
                  </div>
                </div>
              )) : null}
            </div>

            <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/50">
              <p className="text-[11px] text-gray-400">{users.length} account{users.length !== 1 ? 's' : ''} provisioned</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 3 — Structure Management (Zones & KCUs)
// ---------------------------------------------------------------------------

interface StructureManagementTabProps {
  zones: { zoneId: string; zoneName: string }[];
  kcus: KcuRecord[];
  onStructureChange: () => void;  // triggers re-fetch in root after any create
}

interface ZoneForm { zoneId: string; zoneName: string; zoneLeader: string; phone: string; }
interface KcuCreateForm {
  kcuName: string; zoneId: string; kcuType: 'GENERAL' | 'YOUNG_ADULT';
  kcuLeader: string; assistant: string;
  leaderPhone: string; assistantPhone: string;
  meetingDay: string; meetingTime: string; location: string;
}

const EMPTY_ZONE_FORM: ZoneForm = { zoneId: '', zoneName: '', zoneLeader: '', phone: '' };
const EMPTY_KCU_FORM: KcuCreateForm = {
  kcuName: '', zoneId: '', kcuType: 'GENERAL',
  kcuLeader: '', assistant: '',
  leaderPhone: '', assistantPhone: '',
  meetingDay: '', meetingTime: '', location: '',
};
const MEETING_DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

function StructureManagementTab({ zones, kcus, onStructureChange }: StructureManagementTabProps) {
  // Zone form state
  const [zf, setZf]           = useState<ZoneForm>(EMPTY_ZONE_FORM);
  const [zSaving, setZSaving] = useState(false);
  const [zResult, setZResult] = useState<{ ok: boolean; message: string } | null>(null);

  // KCU form state
  const [kf, setKf]           = useState<KcuCreateForm>(EMPTY_KCU_FORM);
  const [kSaving, setKSaving] = useState(false);
  const [kResult, setKResult] = useState<{ ok: boolean; message: string } | null>(null);

  const setZ = <K extends keyof ZoneForm>(k: K, v: ZoneForm[K]) => {
    setZf(p => ({ ...p, [k]: v })); setZResult(null);
  };
  const setK = <K extends keyof KcuCreateForm>(k: K, v: KcuCreateForm[K]) => {
    setKf(p => ({ ...p, [k]: v })); setKResult(null);
  };

  // ── Create Zone ────────────────────────────────────────────────────────────
  const handleCreateZone = async (e: FormEvent) => {
    e.preventDefault();
    if (!zf.zoneId.trim() || !zf.zoneName.trim()) {
      setZResult({ ok: false, message: 'Zone ID and Zone Name are required.' }); return;
    }
    setZSaving(true); setZResult(null);
    try {
      await api.post('/api/admin/zones', {
        zoneId:     zf.zoneId.trim().toUpperCase(),
        zoneName:   zf.zoneName.trim(),
        zoneLeader: zf.zoneLeader.trim() || null,
        phone:      zf.phone.trim() || null,
      });
      setZResult({ ok: true, message: `Zone "${zf.zoneName}" created successfully.` });
      setZf(EMPTY_ZONE_FORM);
      onStructureChange();           // re-fetch zones + KCUs in root
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create zone';
      setZResult({ ok: false, message: msg });
    } finally { setZSaving(false); }
  };

  // ── Create KCU ─────────────────────────────────────────────────────────────
  const handleCreateKcu = async (e: FormEvent) => {
    e.preventDefault();
    if (!kf.kcuName.trim() || !kf.zoneId) {
      setKResult({ ok: false, message: 'KCU Name and Zone assignment are required.' }); return;
    }
    setKSaving(true); setKResult(null);
    try {
      await api.post('/api/admin/kcus', {
        kcuName:        kf.kcuName.trim(),
        kcuType:        kf.kcuType,
        zone:           { zoneId: kf.zoneId },
        kcuLeader:      kf.kcuLeader.trim()       || null,
        assistant:      kf.assistant.trim()        || null,
        leaderPhone:    kf.leaderPhone.trim()      || null,
        assistantPhone: kf.assistantPhone.trim()   || null,
        meetingDay:     kf.meetingDay              || null,
        meetingTime:    kf.meetingTime             || null,
        location:       kf.location.trim()         || null,
      });
      setKResult({ ok: true, message: `KCU "${kf.kcuName}" created successfully.` });
      setKf(EMPTY_KCU_FORM);
      onStructureChange();           // re-fetch zones + KCUs in root
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create KCU';
      setKResult({ ok: false, message: msg });
    } finally { setKSaving(false); }
  };

  const safeZones = Array.isArray(zones) ? zones : [];
  const safeKcus  = Array.isArray(kcus)  ? kcus  : [];

  return (
    <div className="space-y-6">

      {/* ── Current structure summary ── */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200/80 rounded-xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-primary-light rounded-lg flex items-center justify-center shrink-0">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5 text-primary">
              <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
            </svg>
          </div>
          <div>
            <p className="text-[11px] text-gray-400">Total Zones</p>
            <p className="text-2xl font-medium text-gray-800 leading-tight">{safeZones.length}</p>
          </div>
        </div>
        <div className="bg-white border border-gray-200/80 rounded-xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-gold-light rounded-lg flex items-center justify-center shrink-0">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5 text-gold">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
          <div>
            <p className="text-[11px] text-gray-400">Total KCUs</p>
            <p className="text-2xl font-medium text-gray-800 leading-tight">{safeKcus.length}</p>
          </div>
        </div>
      </div>

      {/* ══ Create New Zone ══ */}
      <div className="bg-white border border-gray-200/80 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
          <div className="w-8 h-8 bg-primary-light rounded-lg flex items-center justify-center shrink-0">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-primary">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </div>
          <div>
            <h2 className="font-serif text-[15px] font-normal text-gray-800">Create New Zone</h2>
            <p className="text-[11px] text-gray-400 mt-0.5">Add a new top-level zone to the church hierarchy</p>
          </div>
        </div>

        <form onSubmit={handleCreateZone} noValidate className="px-5 py-5">
          <div className="grid grid-cols-2 gap-x-5 gap-y-4">

            <div>
              <Label required>Zone ID</Label>
              <Input value={zf.zoneId} onChange={(v) => setZ('zoneId', v)}
                placeholder="e.g. Z005" />
              <p className="text-[10.5px] text-gray-400 mt-1">Short unique code — e.g. Z005, Z006</p>
            </div>

            <div>
              <Label required>Zone Name</Label>
              <Input value={zf.zoneName} onChange={(v) => setZ('zoneName', v)}
                placeholder="e.g. Zone 5" />
            </div>

            <div>
              <Label>Zone Leader Name</Label>
              <Input value={zf.zoneLeader} onChange={(v) => setZ('zoneLeader', v)}
                placeholder="Full name of zone leader" />
            </div>

            <div>
              <Label>Leader Phone</Label>
              <Input value={zf.phone} onChange={(v) => setZ('phone', v)}
                placeholder="e.g. 0911000000" type="tel" />
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <ResultBanner result={zResult} />
            <div className="flex justify-end">
              <button type="submit" disabled={zSaving}
                className="px-5 py-2 bg-primary text-white text-[12.5px] font-medium rounded-lg hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                {zSaving
                  ? <><svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" /></svg>Creating…</>
                  : <><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" /></svg>Create Zone</>
                }
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* ══ Create New KCU ══ */}
      <div className="bg-white border border-gray-200/80 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
          <div className="w-8 h-8 bg-gold-light rounded-lg flex items-center justify-center shrink-0">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-gold">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </div>
          <div>
            <h2 className="font-serif text-[15px] font-normal text-gray-800">Create New KCU</h2>
            <p className="text-[11px] text-gray-400 mt-0.5">Add a new cell group under an existing zone</p>
          </div>
        </div>

        <form onSubmit={handleCreateKcu} noValidate className="px-5 py-5">
          <div className="grid grid-cols-2 gap-x-5 gap-y-4">

            <SectionHeading>Cell Group Identity</SectionHeading>

            <div>
              <Label required>KCU Name</Label>
              <Input value={kf.kcuName} onChange={(v) => setK('kcuName', v)}
                placeholder="e.g. Agape Cell" />
            </div>

            <div>
              <Label required>Parent Zone</Label>
              <Select value={kf.zoneId} onChange={(v) => setK('zoneId', v)}>
                <option value="">— Select Zone —</option>
                {safeZones.map((z) => (
                  <option key={z.zoneId} value={z.zoneId}>{z.zoneName} ({z.zoneId})</option>
                ))}
              </Select>
              {safeZones.length === 0 && (
                <p className="text-[10.5px] text-gold mt-1">No zones loaded — create a zone first.</p>
              )}
            </div>

            <div>
              <Label>KCU Type</Label>
              <Select value={kf.kcuType} onChange={(v) => setK('kcuType', v as KcuCreateForm['kcuType'])}>
                <option value="GENERAL">General</option>
                <option value="YOUNG_ADULT">Young Adult</option>
              </Select>
            </div>

            <SectionHeading>Leadership</SectionHeading>

            <div>
              <Label>KCU Leader Name</Label>
              <Input value={kf.kcuLeader} onChange={(v) => setK('kcuLeader', v)}
                placeholder="Full name" />
            </div>

            <div>
              <Label>Leader Phone</Label>
              <Input value={kf.leaderPhone} onChange={(v) => setK('leaderPhone', v)}
                placeholder="e.g. 0911000001" type="tel" />
            </div>

            <div>
              <Label>Assistant Name</Label>
              <Input value={kf.assistant} onChange={(v) => setK('assistant', v)}
                placeholder="Full name" />
            </div>

            <div>
              <Label>Assistant Phone</Label>
              <Input value={kf.assistantPhone} onChange={(v) => setK('assistantPhone', v)}
                placeholder="e.g. 0911000002" type="tel" />
            </div>

            <SectionHeading>Meeting Schedule</SectionHeading>

            <div>
              <Label>Meeting Day</Label>
              <Select value={kf.meetingDay} onChange={(v) => setK('meetingDay', v)}>
                <option value="">— Select Day —</option>
                {MEETING_DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
              </Select>
            </div>

            <div>
              <Label>Meeting Time</Label>
              <Input value={kf.meetingTime} onChange={(v) => setK('meetingTime', v)}
                placeholder="e.g. 18:00" type="time" />
            </div>

            <div className="col-span-full">
              <Label>Location / Address</Label>
              <Input value={kf.location} onChange={(v) => setK('location', v)}
                placeholder="Neighbourhood or full address" />
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <ResultBanner result={kResult} />
            <div className="flex justify-end">
              <button type="submit" disabled={kSaving}
                className="px-5 py-2 bg-gold text-white text-[12.5px] font-medium rounded-lg hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                {kSaving
                  ? <><svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" /></svg>Creating…</>
                  : <><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>Create KCU</>
                }
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* ── Existing structure preview ── */}
      <div className="bg-white border border-gray-200/80 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100">
          <h2 className="font-serif text-[14px] font-normal text-gray-800">Current Structure</h2>
          <p className="text-[11px] text-gray-400 mt-0.5">{safeZones.length} zones · {safeKcus.length} KCUs</p>
        </div>
        {safeZones.length === 0
          ? <div className="px-5 py-8 text-center text-[12px] text-gray-400">No zones found.</div>
          : (
            <div className="divide-y divide-gray-100">
              {safeZones.map((z) => {
                const zKcus = safeKcus.filter((k) => k.zone?.zoneId === z.zoneId);
                return (
                  <div key={z.zoneId} className="px-5 py-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[11px] font-mono text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{z.zoneId}</span>
                      <span className="text-[13px] font-medium text-gray-800">{z.zoneName}</span>
                      <span className="ml-auto text-[11px] text-gray-400">{zKcus.length} KCU{zKcus.length !== 1 ? 's' : ''}</span>
                    </div>
                    {zKcus.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pl-2">
                        {zKcus.map((k) => (
                          <span key={String(k.kcuId)}
                            className="text-[11px] bg-gold-light text-gold px-2 py-0.5 rounded-full">
                            {k.kcuName}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )
        }
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Root component
// ---------------------------------------------------------------------------

type AdminTab = 'onboarding' | 'provisioning' | 'structure';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<AdminTab>('onboarding');

  // Shared data — zones and KCUs loaded once, passed to all tabs
  const [zones, setZones] = useState<{ zoneId: string; zoneName: string }[]>([]);
  const [kcus, setKcus]   = useState<KcuRecord[]>([]);

  const loadStructure = useCallback(() => {
    Promise.all([
      api.get('/api/admin/zones').catch(() => null),
      api.get('/api/admin/kcus').catch(() => null),
    ]).then(([zonesRes, kcusRes]) => {
      if (zonesRes) setZones(toArray<{ zoneId: string; zoneName: string }>(zonesRes.data));
      if (kcusRes)  setKcus(toArray<KcuRecord>(kcusRes.data));
    });
  }, []);

  useEffect(() => { loadStructure(); }, [loadStructure]);

  const tabs: { id: AdminTab; label: string; icon: React.ReactNode }[] = [
    {
      id: 'onboarding',
      label: 'Member Onboarding',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
          <line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" />
        </svg>
      ),
    },
    {
      id: 'provisioning',
      label: 'Staff Provisioning',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      ),
    },
    {
      id: 'structure' as AdminTab,
      label: 'Structure Management',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
          <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
          <line x1="8" y1="2" x2="8" y2="18" /><line x1="16" y1="6" x2="16" y2="22" />
        </svg>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div>
        <h1 className="font-serif text-lg font-normal text-gray-800">Administration</h1>
        <p className="text-[12px] text-gray-400 mt-0.5">
          Member onboarding and staff account management
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 bg-white border border-gray-200/80 rounded-xl p-1 w-fit">
        {tabs.map((tab) => (
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
      {activeTab === 'onboarding'   && <MemberOnboardingTab kcus={kcus} />}
      {activeTab === 'provisioning' && <StaffProvisioningTab zones={zones} kcus={kcus} />}
      {activeTab === 'structure'    && <StructureManagementTab zones={zones} kcus={kcus} onStructureChange={loadStructure} />}
    </div>
  );
}
