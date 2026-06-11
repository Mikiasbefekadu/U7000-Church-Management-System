package com.church.cms.dto.report;

import java.util.List;

/**
 * Result record for the Talent Utilization Scanner:
 * Members with competencies but NOT serving in any ministry.
 */
public record TalentScanDTO(
        String memberId,
        String fullName,
        String phone,
        String zoneName,
        String kcuName,
        List<String> skills
) {}
