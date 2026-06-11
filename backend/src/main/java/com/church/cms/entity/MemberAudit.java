package com.church.cms.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * Audit record for member profile updates.
 *
 * Stored in the isolated audit_log schema to prevent cascade-delete
 * from the main members table from erasing audit history.
 *
 * diff_json format:
 * {
 *   "fieldName": { "before": "oldValue", "after": "newValue" },
 *   ...
 * }
 */
@Entity
@Table(schema = "audit_log", name = "member_audit")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class MemberAudit {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "audit_id")
    private Long auditId;

    /** The member whose profile was changed. No hard FK — audit records survive member deletion. */
    @Column(name = "member_id", nullable = false, length = 50)
    private String memberId;

    /** Username of the authenticated user who performed the update. */
    @Column(name = "changed_by", nullable = false, length = 100)
    private String changedBy;

    /** Timestamp when the aspect captured the change. */
    @Column(name = "changed_at", nullable = false)
    private LocalDateTime changedAt;

    /** Always "UPDATE" for member profile changes. */
    @Column(name = "operation", nullable = false, length = 20)
    private String operation;

    /**
     * JSON diff of changed fields.
     * Stored as JSONB in PostgreSQL for efficient querying.
     */
    @Column(name = "diff_json", nullable = false, columnDefinition = "jsonb")
    private String diffJson;
}
