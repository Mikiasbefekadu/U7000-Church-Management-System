package com.church.cms.controller;

import com.church.cms.dto.report.*;
import com.church.cms.service.ReportService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/reports")
@RequiredArgsConstructor
public class ReportController {

    private final ReportService reportService;

    /**
     * GET /api/reports/membership
     * Category A: Full membership health report.
     * Includes structural gap, demographics, and geographic distribution.
     */
    @GetMapping("/membership")
    public ResponseEntity<MembershipReportDTO> getMembershipReport() {
        return ResponseEntity.ok(reportService.getMembershipReport());
    }

    /**
     * GET /api/reports/attendance?from=YYYY-MM-DD&to=YYYY-MM-DD
     * Category B: Attendance trends, average rates, and care alert lists.
     * Defaults to the last 90 days if no range is provided.
     */
    @GetMapping("/attendance")
    public ResponseEntity<AttendanceReportDTO> getAttendanceReport(
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {

        LocalDate resolvedTo   = to   != null ? to   : LocalDate.now();
        LocalDate resolvedFrom = from != null ? from : resolvedTo.minusDays(90);

        return ResponseEntity.ok(reportService.getAttendanceReport(resolvedFrom, resolvedTo));
    }

    /**
     * GET /api/reports/spiritual
     * Category D: Salvation, baptism funnel, VIP distribution,
     * and the Leadership Anomaly exception list.
     */
    @GetMapping("/spiritual")
    public ResponseEntity<SpiritualReportDTO> getSpiritualReport() {
        return ResponseEntity.ok(reportService.getSpiritualReport());
    }

    /**
     * GET /api/reports/talent?skill=Music
     * Category E: Ministry densities and the Talent Utilization Scanner.
     * Optional ?skill= param narrows the scan to a specific competency keyword.
     */
    @GetMapping("/talent")
    public ResponseEntity<TalentReportDTO> getTalentReport(
            @RequestParam(required = false) String skill) {
        return ResponseEntity.ok(reportService.getTalentReport(skill));
    }
}
