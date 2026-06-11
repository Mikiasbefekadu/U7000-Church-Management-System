package com.church.cms.aspect;

import com.church.cms.entity.Member;
import com.church.cms.entity.MemberAudit;
import com.church.cms.repository.MemberAuditRepository;
import com.church.cms.repository.MemberRepository;
import com.church.cms.security.SecurityContextHelper;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

/**
 * AOP audit aspect for member profile updates.
 *
 * Intercepts every call to {@code MemberService.updateMember(String, ...)} and:
 * 1. Captures the member's field values BEFORE the update.
 * 2. Lets the update proceed.
 * 3. Captures the member's field values AFTER the update.
 * 4. Computes a field-level diff.
 * 5. Persists a {@link MemberAudit} record to {@code audit_log.member_audit}
 *    if at least one field changed.
 *
 * The diff_json format is:
 * <pre>
 * {
 *   "vipStatus":     { "before": "In Progress", "after": "Completed" },
 *   "baptismStatus": { "before": "Candidate",   "after": "Baptized"  }
 * }
 * </pre>
 */
@Slf4j
@Aspect
@Component
@RequiredArgsConstructor
public class MemberAuditAspect {

    private final MemberRepository memberRepository;
    private final MemberAuditRepository memberAuditRepository;
    private final SecurityContextHelper securityContextHelper;
    private final ObjectMapper objectMapper;

    @Around("execution(* com.church.cms.service.MemberService.updateMember(String, ..))")
    public Object auditMemberUpdate(ProceedingJoinPoint pjp) throws Throwable {
        String memberId = (String) pjp.getArgs()[0];

        // ── Capture BEFORE state ──────────────────────────────────────────────
        Member beforeEntity = memberRepository.findById(memberId).orElse(null);
        Map<String, Object> beforeMap = beforeEntity != null
                ? toFieldMap(beforeEntity) : Map.of();

        // ── Execute the actual update ─────────────────────────────────────────
        Object result = pjp.proceed();

        // ── Capture AFTER state ───────────────────────────────────────────────
        Member afterEntity = memberRepository.findById(memberId).orElse(null);
        Map<String, Object> afterMap = afterEntity != null
                ? toFieldMap(afterEntity) : Map.of();

        // ── Compute diff and persist if non-empty ─────────────────────────────
        Map<String, Map<String, Object>> diff = computeDiff(beforeMap, afterMap);
        if (!diff.isEmpty()) {
            try {
                MemberAudit audit = new MemberAudit();
                audit.setMemberId(memberId);
                audit.setChangedBy(securityContextHelper.getCurrentUser().getUsername());
                audit.setChangedAt(LocalDateTime.now());
                audit.setOperation("UPDATE");
                audit.setDiffJson(objectMapper.writeValueAsString(diff));
                memberAuditRepository.save(audit);
                log.debug("[MemberAuditAspect] Audit record saved for member {} — {} field(s) changed",
                        memberId, diff.size());
            } catch (Exception e) {
                // Log but do not fail the update if audit persistence fails
                log.error("[MemberAuditAspect] Failed to persist audit record for member {}: {}",
                        memberId, e.getMessage(), e);
            }
        }

        return result;
    }

    /**
     * Converts a Member entity into a flat map of tracked field names → values.
     * Only fields that are meaningful to audit are included.
     */
    private Map<String, Object> toFieldMap(Member m) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("fullName",        m.getFullName());
        map.put("phone",           m.getPhone());
        map.put("gender",          m.getGender());
        map.put("birthDate",       m.getBirthDate());
        map.put("maritalStatus",   m.getMaritalStatus());
        map.put("salvationStatus", m.getSalvationStatus());
        map.put("salvationDate",   m.getSalvationDate());
        map.put("baptismStatus",   m.getBaptismStatus());
        map.put("rightHandGiven",  m.getRightHandGiven());
        map.put("vipStatus",       m.getVipStatus());
        map.put("memberStatus",    m.getMemberStatus());
        map.put("notes",           m.getNotes());
        map.put("zoneId",          m.getZone() != null ? m.getZone().getZoneId()  : null);
        map.put("kcuId",           m.getKcu()  != null ? m.getKcu().getKcuId()    : null);
        return map;
    }

    /**
     * Returns a map containing only the fields that differ between before and after.
     * Each entry has the shape: { "before": oldValue, "after": newValue }.
     */
    private Map<String, Map<String, Object>> computeDiff(
            Map<String, Object> before, Map<String, Object> after) {

        Map<String, Map<String, Object>> diff = new LinkedHashMap<>();
        for (String key : after.keySet()) {
            Object bVal = before.get(key);
            Object aVal = after.get(key);
            if (!Objects.equals(bVal, aVal)) {
                Map<String, Object> change = new LinkedHashMap<>();
                change.put("before", bVal != null ? bVal : "null");
                change.put("after",  aVal != null ? aVal : "null");
                diff.put(key, change);
            }
        }
        return diff;
    }
}
