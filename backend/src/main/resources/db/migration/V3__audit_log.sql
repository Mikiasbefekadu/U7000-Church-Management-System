-- =============================================================================
-- V3__audit_log.sql
-- Creates the audit_log schema and member_audit table.
--
-- This migration is separate from V1 because the database was originally
-- created by Hibernate (ddl-auto=update) before Flyway was introduced.
-- Flyway recorded V1 as already applied without executing it, so the
-- audit_log objects from V1 were never created. V3 creates them idempotently.
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS audit_log;

CREATE TABLE IF NOT EXISTS audit_log.member_audit (
    audit_id    BIGSERIAL    PRIMARY KEY,
    member_id   VARCHAR(50)  NOT NULL,
    changed_by  VARCHAR(100) NOT NULL,
    changed_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
    operation   VARCHAR(20)  NOT NULL,
    diff_json   JSONB        NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_member_audit_member ON audit_log.member_audit(member_id);
CREATE INDEX IF NOT EXISTS idx_member_audit_time   ON audit_log.member_audit(changed_at);
