package com.church.cms.dto.report;

import java.util.List;

/**
 * Result record for the Leadership Anomaly Rule:
 * Members serving in a ministry but VIP status is NOT 'Completed'.
 */
public record LeadershipAnomalyDTO(
        String memberId,
        String fullName,
        String phone,
        String vipStatus,
        String zoneName,
        String kcuName,
        List<String> ministriesServing
) {}
