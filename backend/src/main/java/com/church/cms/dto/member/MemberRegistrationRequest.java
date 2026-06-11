package com.church.cms.dto.member;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;
import java.util.List;

/**
 * Multi-stage registration wizard payload.
 * Maps directly to the paper form (የቤተ ክርስቲያን አባላት መመዝገቢያ ቅጽ).
 * Saves member, children, and ministry assignments in a single transaction.
 */
public record MemberRegistrationRequest(

        // ── Core identity ─────────────────────────────────────────────────────
        @NotBlank String memberId,
        @NotBlank String fullName,
        @NotBlank String phone,
        @NotNull  String gender,
        LocalDate birthDate,
        String maritalStatus,
        String partnerId,       // Optional: link to existing member as spouse

        // ── Hierarchy assignment ──────────────────────────────────────────────
        String zoneId,
        String kcuId,

        // ── Spiritual milestones ──────────────────────────────────────────────
        Integer salvationStatus,
        LocalDate salvationDate,
        String baptismStatus,
        String rightHandGiven,
        String vipStatus,

        // ── Family ────────────────────────────────────────────────────────────
        List<ChildRegistrationRequest> children,

        // ── Ministry & skills ─────────────────────────────────────────────────
        List<String> ministryIds,
        List<String> competencyIds,

        String notes
) {}
