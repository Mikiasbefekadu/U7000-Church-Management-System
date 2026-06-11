package com.church.cms.dto.auth;

/**
 * Payload for PATCH /api/profile.
 *
 * All fields are optional — only non-null values are applied.
 * Password change requires both currentPassword and newPassword.
 */
public record ProfileUpdateRequest(
        /** New display name (username). Optional. */
        String displayName,

        /** Current password — required when changing password. */
        String currentPassword,

        /** New password — applied only when currentPassword is also provided. */
        String newPassword
) {}
