package com.church.cms.controller;

import com.church.cms.entity.*;
import com.church.cms.service.AdminService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN', 'PASTOR')")
public class AdminController {

    private final AdminService adminService;

    // ── Zones ─────────────────────────────────────────────────────────────────
    @GetMapping("/zones")
    public ResponseEntity<List<Zone>> getZones() {
        return ResponseEntity.ok(adminService.getAllZones());
    }

    @PostMapping("/zones")
    public ResponseEntity<Zone> createZone(@RequestBody Zone zone) {
        return ResponseEntity.status(HttpStatus.CREATED).body(adminService.saveZone(zone));
    }

    @PutMapping("/zones/{zoneId}")
    public ResponseEntity<Zone> updateZone(@PathVariable String zoneId, @RequestBody Zone zone) {
        zone.setZoneId(zoneId);
        return ResponseEntity.ok(adminService.saveZone(zone));
    }

    @DeleteMapping("/zones/{zoneId}")
    public ResponseEntity<Void> deleteZone(@PathVariable String zoneId) {
        adminService.deleteZone(zoneId);
        return ResponseEntity.noContent().build();
    }

    // ── KCUs ──────────────────────────────────────────────────────────────────
    @GetMapping("/kcus")
    public ResponseEntity<List<Kcu>> getKcus(
            @RequestParam(required = false) String zoneId) {
        List<Kcu> result = zoneId != null
                ? adminService.getKcusByZone(zoneId)
                : adminService.getAllKcus();
        return ResponseEntity.ok(result);
    }

    @PostMapping("/kcus")
    public ResponseEntity<Kcu> createKcu(@RequestBody Kcu kcu) {
        return ResponseEntity.status(HttpStatus.CREATED).body(adminService.saveKcu(kcu));
    }

    @PutMapping("/kcus/{kcuId}")
    public ResponseEntity<Kcu> updateKcu(@PathVariable Long kcuId, @RequestBody Kcu kcu) {
        kcu.setKcuId(kcuId);
        return ResponseEntity.ok(adminService.saveKcu(kcu));
    }

    @DeleteMapping("/kcus/{kcuId}")
    public ResponseEntity<Void> deleteKcu(@PathVariable Long kcuId) {
        adminService.deleteKcu(kcuId);
        return ResponseEntity.noContent().build();
    }

    // ── Ministries ────────────────────────────────────────────────────────────
    @GetMapping("/ministries")
    public ResponseEntity<List<Ministry>> getMinistries() {
        return ResponseEntity.ok(adminService.getAllMinistries());
    }

    @PostMapping("/ministries")
    public ResponseEntity<Ministry> createMinistry(@RequestBody Ministry ministry) {
        return ResponseEntity.status(HttpStatus.CREATED).body(adminService.saveMinistry(ministry));
    }

    // ── Competencies ──────────────────────────────────────────────────────────
    @GetMapping("/competencies")
    public ResponseEntity<List<Competency>> getCompetencies() {
        return ResponseEntity.ok(adminService.getAllCompetencies());
    }

    @PostMapping("/competencies")
    public ResponseEntity<Competency> createCompetency(@RequestBody Competency competency) {
        return ResponseEntity.status(HttpStatus.CREATED).body(adminService.saveCompetency(competency));
    }

    // ── User accounts ─────────────────────────────────────────────────────────
    @GetMapping("/users")
    public ResponseEntity<List<User>> getUsers() {
        return ResponseEntity.ok(adminService.getAllUsers());
    }

    @PostMapping("/users")
    public ResponseEntity<User> createUser(@RequestBody User user) {
        return ResponseEntity.status(HttpStatus.CREATED).body(adminService.createUser(user));
    }

    @PatchMapping("/users/{userId}/reset-password")
    public ResponseEntity<Map<String, String>> resetPassword(
            @PathVariable String userId,
            @RequestBody Map<String, String> body) {
        adminService.resetPassword(userId, body.get("newPassword"));
        return ResponseEntity.ok(Map.of("status", "Password updated successfully"));
    }
}
