package com.church.cms.dto.report;

import java.util.List;
import java.util.Map;

public record MembershipReportDTO(
        long totalActive,
        long totalInactive,
        long newThisMonth,
        long newThisQuarter,
        long newThisYear,
        long membersWithNoKcu,
        Map<String, Long> genderDistribution,
        Map<String, Long> ageDistribution,
        Map<String, Long> maritalStatusDistribution,
        Map<String, Long> locationDistribution
) {}
