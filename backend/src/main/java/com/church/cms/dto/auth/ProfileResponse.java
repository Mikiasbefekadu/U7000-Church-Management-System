package com.church.cms.dto.auth;

/**
 * Response payload for GET /api/profile.
 * Never includes the password hash.
 */
public record ProfileResponse(
        String userId,
        String username,
        String role,
        String assignedZoneId,
        String assignedKcuId
) {}
