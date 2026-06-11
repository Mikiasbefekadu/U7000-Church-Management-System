package com.church.cms.controller;

import com.church.cms.dto.auth.ProfileResponse;
import com.church.cms.dto.auth.ProfileUpdateRequest;
import com.church.cms.entity.User;
import com.church.cms.repository.UserRepository;
import com.church.cms.security.SecurityContextHelper;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Self-service profile endpoint — accessible to every authenticated role.
 *
 * GET  /api/profile       → return the caller's own profile (no password)
 * PATCH /api/profile      → update display name and/or password
 *
 * Password change rules:
 *   - currentPassword is mandatory when newPassword is supplied
 *   - currentPassword is verified against the stored BCrypt hash before applying
 */
@RestController
@RequestMapping("/api/profile")
@RequiredArgsConstructor
public class ProfileController {

    private final SecurityContextHelper securityContextHelper;
    private final UserRepository        userRepository;
    private final PasswordEncoder       passwordEncoder;

    // ── GET /api/profile ──────────────────────────────────────────────────────

    @GetMapping
    public ResponseEntity<ProfileResponse> getProfile() {
        User user = securityContextHelper.getCurrentUser();
        return ResponseEntity.ok(toResponse(user));
    }

    // ── PATCH /api/profile ────────────────────────────────────────────────────

    @PatchMapping
    public ResponseEntity<Map<String, String>> updateProfile(
            @RequestBody ProfileUpdateRequest req) {

        User user = securityContextHelper.getCurrentUser();

        // ── Display name / username update ────────────────────────────────────
        boolean changed = false;
        if (req.displayName() != null && !req.displayName().isBlank()) {
            String newName = req.displayName().trim();
            if (!newName.equals(user.getUsername())) {
                // Check uniqueness before applying
                if (userRepository.existsByUsername(newName)) {
                    return ResponseEntity.badRequest()
                            .body(Map.of("error", "Username '" + newName + "' is already taken."));
                }
                user.setUsername(newName);
                changed = true;
            }
        }

        // ── Password change ───────────────────────────────────────────────────
        if (req.newPassword() != null && !req.newPassword().isBlank()) {
            if (req.currentPassword() == null || req.currentPassword().isBlank()) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "Current password is required to set a new password."));
            }
            if (!passwordEncoder.matches(req.currentPassword(), user.getPassword())) {
                throw new BadCredentialsException("Current password is incorrect.");
            }
            if (req.newPassword().length() < 6) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "New password must be at least 6 characters."));
            }
            user.setPassword(passwordEncoder.encode(req.newPassword()));
            changed = true;
        }

        if (changed) {
            userRepository.save(user);
        }

        return ResponseEntity.ok(Map.of("message", "Profile updated successfully."));
    }

    // ── Mapper ────────────────────────────────────────────────────────────────

    private ProfileResponse toResponse(User u) {
        return new ProfileResponse(
                u.getUserId(),
                u.getUsername(),
                u.getRole(),
                u.getAssignedZone() != null ? u.getAssignedZone().getZoneId() : null,
                u.getAssignedKcu()  != null ? String.valueOf(u.getAssignedKcu().getKcuId()) : null
        );
    }
}
