package com.church.cms.dto.attendance;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

/**
 * Single record in a bulk attendance submission payload.
 * The controller accepts List<AttendanceSubmissionDTO>.
 */
public record AttendanceSubmissionDTO(
        @NotBlank String memberId,
        @NotBlank String eventType,   // KCU, SUNDAY, WEDNESDAY, SPECIAL
        @NotNull  LocalDate attDate,
        @NotBlank String status       // PRESENT, ABSENT
) {}
