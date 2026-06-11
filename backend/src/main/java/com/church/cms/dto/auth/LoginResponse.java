package com.church.cms.dto.auth;

public record LoginResponse(
        String token,
        String userId,
        String username,
        String role,
        String assignedZoneId,
        String assignedKcuId
) {}
