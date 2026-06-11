package com.church.cms.dto.report;

import com.church.cms.dto.member.MemberSummaryDTO;

import java.util.List;
import java.util.Map;

public record SpiritualReportDTO(
        long totalWithSalvation,
        long totalWithoutSalvation,
        Map<String, Long> salvationsByMonth,
        long totalBaptized,
        long totalNotBaptized,
        long baptismCandidates,
        Map<String, Long> vipStatusDistribution,
        List<LeadershipAnomalyDTO> leadershipAnomalies
) {}
