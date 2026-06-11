package com.church.cms.dto.report;

import java.util.List;
import java.util.Map;

public record TalentReportDTO(
        Map<String, Long> ministryDensities,
        List<TalentScanDTO> talentNotServing
) {}
