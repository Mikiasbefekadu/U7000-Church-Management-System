package com.church.cms.repository;

import com.church.cms.entity.MemberAudit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Repository for member profile audit records.
 * Backed by audit_log.member_audit (PostgreSQL JSONB column for diff_json).
 */
@Repository
public interface MemberAuditRepository extends JpaRepository<MemberAudit, Long> {

    /**
     * Returns the full audit history for a member, newest first.
     * Used by admin/audit endpoints to display change history.
     */
    List<MemberAudit> findByMemberIdOrderByChangedAtDesc(String memberId);
}
