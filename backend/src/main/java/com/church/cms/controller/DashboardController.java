package com.church.cms.controller;

import com.church.cms.dto.dashboard.DashboardKpiDTO;
import com.church.cms.service.ReportService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/dashboard")
@RequiredArgsConstructor
public class DashboardController {

    private final ReportService reportService;

    /**
     * GET /api/dashboard/kpis
     * Returns the 7 top-level KPI blocks, pre-scoped by the caller's RBAC fence.
     */
    @GetMapping("/kpis")
    public ResponseEntity<DashboardKpiDTO> getKpis() {
        return ResponseEntity.ok(reportService.getDashboardKpis());
    }
}
