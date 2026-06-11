/**
 * userService.ts
 *
 * Self-service profile API calls.
 * The JWT is attached automatically by the Axios interceptor in api.ts.
 *
 * Endpoints:
 *   GET   /api/profile   → ProfileResponse
 *   PATCH /api/profile   → { message } | { error }
 */

import api from './api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProfileResponse {
  userId: string;
  username: string;
  role: string;
  assignedZoneId: string | null;
  assignedKcuId: string | null;
}

export interface ProfileUpdatePayload {
  /** New display name / username. Omit to leave unchanged. */
  displayName?: string;
  /** Required when changing password. */
  currentPassword?: string;
  /** New password. Requires currentPassword. */
  newPassword?: string;
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/** Fetch the caller's own profile. */
export async function getMyProfile(): Promise<ProfileResponse> {
  const res = await api.get<ProfileResponse>('/api/profile');
  return res.data;
}

/**
 * Update the caller's display name and/or password.
 *
 * Throws an AxiosError on HTTP error responses.
 * The error body follows { error: string } from the backend.
 */
export async function updateMyProfile(
  payload: ProfileUpdatePayload,
): Promise<string> {
  const res = await api.patch<{ message?: string; error?: string }>(
    '/api/profile',
    payload,
  );
  return res.data.message ?? 'Profile updated.';
}
