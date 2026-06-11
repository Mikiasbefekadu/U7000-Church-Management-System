package com.church.cms.security;

import com.church.cms.entity.User;
import com.church.cms.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

/**
 * Resolves the currently authenticated user's identity and scope.
 *
 * Two resolution strategies are provided:
 *
 * 1. JWT-direct (preferred for hot-path service scoping):
 *    Reads role/kcuId/zoneId directly from the raw JWT string stored in
 *    Authentication.details by JwtAuthFilter — zero DB roundtrips.
 *
 * 2. DB-backed (used for audit trail and admin operations):
 *    Loads the full User entity from the database via UserRepository.
 */
@Component
@RequiredArgsConstructor
public class SecurityContextHelper {

    private final UserRepository userRepository;
    private final JwtUtil jwtUtil;

    // ── DB-backed resolution ──────────────────────────────────────────────────

    public User getCurrentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String username = auth.getName();
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException(
                        "Authenticated user not found in database: " + username));
    }

    /** @deprecated Prefer {@link #getCurrentUserRoleFromJwt()} to avoid DB hit. */
    public String getCurrentUserRole() {
        return getCurrentUser().getRole();
    }

    /** @deprecated Prefer {@link #getCurrentUserZoneIdFromJwt()} to avoid DB hit. */
    public String getCurrentUserZoneId() {
        User user = getCurrentUser();
        return user.getAssignedZone() != null ? user.getAssignedZone().getZoneId() : null;
    }

    /** @deprecated Prefer {@link #getCurrentUserKcuIdFromJwt()} to avoid DB hit. */
    public String getCurrentUserKcuId() {
        User user = getCurrentUser();
        return user.getAssignedKcu() != null
            ? String.valueOf(user.getAssignedKcu().getKcuId())
            : null;
    }

    // ── JWT-direct resolution (no DB roundtrip) ───────────────────────────────

    /**
     * Returns the raw JWT string stored in Authentication.details by JwtAuthFilter.
     * Throws if the details are not a String (e.g. in tests without a real JWT).
     */
    private String getRawJwt() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        Object details = auth.getDetails();
        if (details instanceof String jwt) {
            return jwt;
        }
        throw new RuntimeException(
                "Raw JWT not available in SecurityContext details. " +
                "Ensure JwtAuthFilter stores the token string in authToken.setDetails(jwt).");
    }

    /**
     * Extracts the 'role' claim from the current request's JWT.
     * No database query is issued.
     */
    public String getCurrentUserRoleFromJwt() {
        return jwtUtil.extractRole(getRawJwt());
    }

    /**
     * Extracts the 'kcuId' claim from the current request's JWT.
     * Returns an empty string for ADMIN/PASTOR who have no KCU assignment.
     * No database query is issued.
     */
    public String getCurrentUserKcuIdFromJwt() {
        return jwtUtil.extractKcuId(getRawJwt());
    }

    /**
     * Extracts the 'zoneId' claim from the current request's JWT.
     * Returns an empty string for ADMIN/PASTOR who have no zone assignment.
     * No database query is issued.
     */
    public String getCurrentUserZoneIdFromJwt() {
        return jwtUtil.extractZoneId(getRawJwt());
    }
}
