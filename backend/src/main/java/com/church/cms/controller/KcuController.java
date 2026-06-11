package com.church.cms.controller;

import com.church.cms.entity.Kcu;
import com.church.cms.repository.KcuRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Read-only KCU endpoint accessible to all authenticated roles
 * (ADMIN, PASTOR, ZONE_LEADER, KCU_LEADER).
 *
 * <p>Mutation operations (POST/PUT/DELETE) remain in AdminController
 * under /api/admin/kcus, which is locked to ADMIN/PASTOR only.
 *
 * <p>Endpoints:
 * <pre>
 *   GET /api/kcus              → all KCUs (ADMIN/PASTOR use-case)
 *   GET /api/kcus?zoneId=Z001  → KCUs filtered by zone (ZONE_LEADER use-case)
 * </pre>
 */
@RestController
@RequestMapping("/api/kcus")
@RequiredArgsConstructor
public class KcuController {

    private final KcuRepository kcuRepository;

    /**
     * Returns all KCUs, optionally filtered by zone.
     *
     * @param zoneId optional zone business code (e.g. "Z001")
     * @return list of KCU entities — empty array when none match
     */
    @GetMapping
    public ResponseEntity<List<Kcu>> getKcus(
            @RequestParam(required = false) String zoneId) {

        List<Kcu> result = (zoneId != null && !zoneId.isBlank())
                ? kcuRepository.findByZone_ZoneId(zoneId.trim())
                : kcuRepository.findAll();

        return ResponseEntity.ok(result);
    }
}
