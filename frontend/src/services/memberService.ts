/**
 * memberService.ts — CRUD operations for the Members Hub.
 *
 * All types mirror the Java DTOs in the Spring Boot backend exactly:
 *   MemberSummaryDTO       → MemberSummary
 *   MemberProfileDTO       → MemberProfile
 *   MemberRegistrationRequest → MemberRegistrationRequest
 *
 * Endpoints (from API_SPECIFICATION.md):
 *   GET    /api/members                  → paginated list
 *   GET    /api/members/{memberId}       → full profile
 *   POST   /api/members/register         → create member (201)
 *   PUT    /api/members/{memberId}       → update member (full replace)
 */

import api from './api';

// ---------------------------------------------------------------------------
// Types — kept in this file for co-location; export for use in components
// ---------------------------------------------------------------------------

/** Lightweight row used in the paginated member list. */
export interface MemberSummary {
  memberId: string;
  fullName: string;
  phone: string;
  gender: 'Male' | 'Female';
  /** ISO-8601 date string: "YYYY-MM-DD" */
  birthDate: string | null;
  maritalStatus: 'Single' | 'Married' | null;
  memberStatus: 'Active' | 'Inactive';
  vipStatus: 'Not Started' | 'In Progress' | 'Completed' | null;
  baptismStatus: 'Baptized' | 'Candidate' | null;
  zoneName: string | null;
  kcuName: string | null;
}

/** Child record nested inside a full member profile. */
export interface ChildRecord {
  childId: string | null;
  childName: string;
  childDob: string | null;
  childGender: 'Male' | 'Female' | null;
}

/** Full profile payload — used by the Member Profile drilldown page. */
export interface MemberProfile {
  memberId: string;
  fullName: string;
  phone: string;
  gender: 'Male' | 'Female';
  birthDate: string | null;
  maritalStatus: 'Single' | 'Married' | null;
  memberStatus: 'Active' | 'Inactive';
  joinDate: string | null;
  notes: string | null;

  // Spiritual milestones
  salvationStatus: 0 | 1 | null;
  salvationDate: string | null;
  baptismStatus: 'Baptized' | 'Candidate' | null;
  rightHandGiven: 'Yes' | 'No' | null;
  vipStatus: 'Not Started' | 'In Progress' | 'Completed' | null;

  // Hierarchy
  zoneId: string | null;
  zoneName: string | null;
  kcuId: string | null;
  kcuName: string | null;

  // Family
  partnerId: string | null;
  partnerName: string | null;
  children: ChildRecord[];

  // Ministries and skills
  ministries: string[];
  competencies: string[];
}

/** Payload for the registration wizard (POST /api/members/register). */
export interface MemberRegistrationRequest {
  memberId: string;
  fullName: string;
  phone: string;
  gender: 'Male' | 'Female';
  birthDate?: string | null;
  maritalStatus?: 'Single' | 'Married' | null;
  partnerId?: string | null;

  zoneId?: string | null;
  kcuId?: string | null;

  salvationStatus?: 0 | 1 | null;
  salvationDate?: string | null;
  baptismStatus?: 'Baptized' | 'Candidate' | null;
  rightHandGiven?: 'Yes' | 'No' | null;
  vipStatus?: 'Not Started' | 'In Progress' | 'Completed' | null;

  children?: ChildRecord[];
  ministryIds?: string[];
  competencyIds?: string[];
  notes?: string | null;
}

/** Payload for a full member update (PUT /api/members/{memberId}). */
export type MemberUpdateRequest = Partial<Omit<MemberRegistrationRequest, 'memberId'>>;

/** Spring Page<T> wrapper returned by GET /api/members. */
export interface Page<T> {
  content: T[];
  pageable: {
    pageNumber: number;
    pageSize: number;
    sort: { sorted: boolean; unsorted: boolean };
  };
  totalElements: number;
  totalPages: number;
  last: boolean;
  first: boolean;
  numberOfElements: number;
}

/** Optional query filters for the member list. */
export interface MemberListParams {
  zoneId?: string;
  kcuId?: string;
  gender?: 'Male' | 'Female';
  status?: 'Active' | 'Inactive';
  marital?: 'Single' | 'Married';
  page?: number;
  size?: number;
  sort?: string;
}

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

/**
 * Fetch a paginated, filtered list of members.
 * The backend applies the RBAC data fence automatically — no scope params needed.
 *
 * @example
 *   const page = await getMembers({ status: 'Active', size: 50 });
 */
export async function getMembers(
  params: MemberListParams = {},
): Promise<Page<MemberSummary>> {
  const response = await api.get<Page<MemberSummary>>('/api/members', { params });
  return response.data;
}

/**
 * Fetch the full profile for a single member.
 *
 * @param memberId  e.g. "M011"
 *
 * @example
 *   const profile = await getMemberProfile('M011');
 */
export async function getMemberProfile(memberId: string): Promise<MemberProfile> {
  const response = await api.get<MemberProfile>(`/api/members/${memberId}`);
  return response.data;
}

/**
 * Register a new member via the multi-stage wizard.
 * Returns the lightweight summary of the created member (201 Created).
 *
 * @example
 *   const created = await registerMember({ memberId: 'M013', fullName: '...', ... });
 */
export async function registerMember(
  data: MemberRegistrationRequest,
): Promise<MemberSummary> {
  const response = await api.post<MemberSummary>('/api/members/register', data);
  return response.data;
}

/**
 * Update an existing member's details (full replace via PUT).
 *
 * @param memberId  The member to update, e.g. "M011"
 * @param data      Fields to update — all optional except those the backend validates
 *
 * @example
 *   const updated = await updateMember('M011', { vipStatus: 'Completed' });
 */
export async function updateMember(
  memberId: string,
  data: MemberUpdateRequest,
): Promise<MemberProfile> {
  const response = await api.put<MemberProfile>(`/api/members/${memberId}`, data);
  return response.data;
}
