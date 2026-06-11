package com.church.cms.controller;

import com.church.cms.dto.followup.FollowUpDTO;
import com.church.cms.dto.followup.FollowUpUpdateRequest;
import com.church.cms.service.FollowUpService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/followups")
@RequiredArgsConstructor
public class FollowUpController {

    private final FollowUpService followUpService;

    /**
     * GET /api/followups
     * Returns the PENDING follow-up worklist scoped to the caller's role.
     * KCU_LEADER sees only their assigned cases.
     * ZONE_LEADER sees all cases in their zone.
     * ADMIN/PASTOR sees everything.
     */
    @GetMapping
    public ResponseEntity<List<FollowUpDTO>> getPendingFollowUps() {
        return ResponseEntity.ok(followUpService.getPendingFollowUps());
    }

    /**
     * GET /api/followups/overdue
     * Returns PENDING follow-ups not actioned within 72 hours.
     */
    @GetMapping("/overdue")
    public ResponseEntity<List<FollowUpDTO>> getOverdueFollowUps() {
        return ResponseEntity.ok(followUpService.getOverdueFollowUps());
    }

    /**
     * PATCH /api/followups/{followupId}
     * Leader logs action: updates status (PENDING → RESOLVED) and adds notes.
     */
    @PatchMapping("/{followupId}")
    public ResponseEntity<FollowUpDTO> updateFollowUp(
            @PathVariable String followupId,
            @Valid @RequestBody FollowUpUpdateRequest request) {
        return ResponseEntity.ok(followUpService.updateFollowUp(followupId, request));
    }
}
