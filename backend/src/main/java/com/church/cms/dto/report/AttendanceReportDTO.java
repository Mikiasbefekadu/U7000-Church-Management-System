package com.church.cms.dto.report;

import com.church.cms.dto.member.MemberSummaryDTO;

import java.util.List;
import java.util.Map;

public record AttendanceReportDTO(
        Map<String, Double> averageRateByEventType,
        List<TrendPoint> weeklyTrend,
        List<MemberSummaryDTO> absentTwoPlusWeeks,
        List<MemberSummaryDTO> absentOneMonth
) {
    public record TrendPoint(String date, long presentCount) {}
}
