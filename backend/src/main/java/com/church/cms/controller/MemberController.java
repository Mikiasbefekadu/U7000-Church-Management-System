package com.church.cms.controller;

import com.church.cms.dto.member.*;
import com.church.cms.service.MemberService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/members")
@RequiredArgsConstructor
public class MemberController {

    private final MemberService memberService;

    /**
     * GET /api/members
     * Paginated, multi-param filtered member list.
     * RBAC fence is applied transparently inside MemberService.
     *
     * Query params: zoneId, kcuId, gender, status, marital, page, size, sort
     */
    @GetMapping
    public ResponseEntity<Page<MemberSummaryDTO>> getMembers(
            @RequestParam(required = false) String zoneId,
            @RequestParam(required = false) String kcuId,
            @RequestParam(required = false) String gender,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String marital,
            @PageableDefault(size = 20, sort = "fullName") Pageable pageable) {

        return ResponseEntity.ok(
                memberService.getMembers(zoneId, kcuId, gender, status, marital, pageable));
    }

    /**
     * GET /api/members/{memberId}
     * Full profile drilldown including family, ministries, competencies, and attendance.
     */
    @GetMapping("/{memberId}")
    public ResponseEntity<MemberProfileDTO> getMemberProfile(@PathVariable String memberId) {
        return ResponseEntity.ok(memberService.getMemberProfile(memberId));
    }

    /**
     * POST /api/members/register
     * Multi-stage transactional registration wizard.
     * Saves member + children + ministry + competency assignments atomically.
     */
    @PostMapping("/register")
    public ResponseEntity<MemberSummaryDTO> registerMember(
            @Valid @RequestBody MemberRegistrationRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(memberService.registerMember(request));
    }

    /**
     * PUT /api/members/{memberId}
     * Updates an existing member's profile fields.
     * Only non-null fields in the request body are applied (partial update semantics).
     * Every successful update is captured by MemberAuditAspect and written to
     * audit_log.member_audit as a field-level JSON diff.
     */
    @PutMapping("/{memberId}")
    public ResponseEntity<MemberSummaryDTO> updateMember(
            @PathVariable String memberId,
            @Valid @RequestBody MemberRegistrationRequest request) {
        return ResponseEntity.ok(memberService.updateMember(memberId, request));
    }
}
