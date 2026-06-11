package com.church.cms.dto.member;

import java.time.LocalDate;

/**
 * Lightweight projection used in paginated list views and report result sets.
 */
public record MemberSummaryDTO(
        String memberId,
        String fullName,
        String phone,
        String gender,
        LocalDate birthDate,
        String maritalStatus,
        String memberStatus,
        String vipStatus,
        String baptismStatus,
        String zoneName,
        String kcuName
) {}
