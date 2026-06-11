package com.church.cms.controller;

import com.church.cms.service.DataSeederService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Admin-only endpoint to trigger the KCU Excel seeder.
 *
 * <p>POST /api/admin/seed/kcus
 * <br>Requires ADMIN or PASTOR role (JWT).
 */
@RestController
@RequestMapping("/api/admin/seed")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN', 'PASTOR')")
public class DataSeederController {

    private final DataSeederService dataSeederService;

    /**
     * Parses KCUs.xlsx from the classpath and seeds the kcus table.
     * Safe to call multiple times — each call appends new rows; existing rows
     * are not modified (no upsert logic, so run once on a clean table).
     *
     * @return JSON with a "message" field summarising saved / skipped counts
     */
    @PostMapping("/kcus")
    public ResponseEntity<Map<String, String>> seedKcus() {
        String result = dataSeederService.seedKcuDataFromExcel();
        return ResponseEntity.ok(Map.of("message", result));
    }
}
