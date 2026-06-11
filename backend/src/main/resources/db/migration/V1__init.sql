-- =============================================================================
-- Church Management System — Complete PostgreSQL DDL
-- Stack: Spring Boot 4.x / Jakarta Persistence / PostgreSQL
-- Generated from: 11-entity JPA model (SYSTEM_BLUEPRINT.md)
--
-- USAGE:
--   Option A (recommended for dev): Let Hibernate manage DDL via
--     spring.jpa.hibernate.ddl-auto=update  (already set in application.properties)
--   Option B (production / clean setup): Run this file manually against church_db
--     psql -U postgres -d church_db -f schema.sql
--
-- TABLE CREATION ORDER respects FK dependencies:
--   zones → kcus → members → children
--                           → attendance
--                           → follow_ups
--                           → member_ministries
--                           → member_competencies
--   ministries  (standalone lookup)
--   competencies (standalone lookup)
--   users → zones, kcus, members
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 0. EXTENSIONS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- for gen_random_uuid() if needed

-- =============================================================================
-- 1. ZONES
--    Top-level regional grouping. Each zone has one named leader.
-- =============================================================================
CREATE TABLE IF NOT EXISTS zones (
    zone_id     VARCHAR(50)  PRIMARY KEY,
    zone_name   VARCHAR(100) NOT NULL,
    zone_leader VARCHAR(100),
    phone       VARCHAR(20)
);

-- =============================================================================
-- 2. KCUS  (Home Cell Units)
--    Each KCU belongs to one Zone.
--    kcu_type: 'GENERAL' | 'YOUNG_ADULT'
-- =============================================================================
CREATE TABLE IF NOT EXISTS kcus (
    kcu_id          VARCHAR(50)  PRIMARY KEY,
    zone_id         VARCHAR(50)  REFERENCES zones(zone_id) ON DELETE SET NULL,
    kcu_name        VARCHAR(100) NOT NULL,
    kcu_type        VARCHAR(20)  NOT NULL DEFAULT 'GENERAL',
    kcu_leader      VARCHAR(100),
    assistant       VARCHAR(100),
    leader_phone    VARCHAR(20),
    assistant_phone VARCHAR(20),
    meeting_day     VARCHAR(20),
    meeting_time    VARCHAR(20),
    location        VARCHAR(200)
);

-- =============================================================================
-- 3. MINISTRIES  (Lookup — MIN01 through MIN13)
-- =============================================================================
CREATE TABLE IF NOT EXISTS ministries (
    min_id  VARCHAR(50)  PRIMARY KEY,
    name_am VARCHAR(100),           -- Amharic name
    name_en VARCHAR(100)            -- English name
);

-- =============================================================================
-- 4. COMPETENCIES  (Lookup — skill/talent catalogue)
-- =============================================================================
CREATE TABLE IF NOT EXISTS competencies (
    comp_id    VARCHAR(50)  PRIMARY KEY,
    skill_name VARCHAR(100)
);

-- =============================================================================
-- 5. MEMBERS  (Core domain entity)
--    Belongs to one Zone and one KCU (both nullable — structural gap tracking).
--    Self-references partner_member_id for spouse linking.
--    Spiritual milestones: salvation, baptism, vip_status.
-- =============================================================================
CREATE TABLE IF NOT EXISTS members (
    member_id         VARCHAR(50)  PRIMARY KEY,
    full_name         VARCHAR(200) NOT NULL,
    phone             VARCHAR(20)  NOT NULL UNIQUE,
    gender            VARCHAR(20),
    birth_date        DATE,
    marital_status    VARCHAR(30),
    partner_member_id VARCHAR(50)  REFERENCES members(member_id) ON DELETE SET NULL,

    -- Spiritual milestones
    salvation_status  INTEGER      NOT NULL DEFAULT 0,  -- 0=No, 1=Yes
    salvation_date    DATE,
    baptism_status    VARCHAR(30),                      -- 'Baptized' | 'Candidate' | NULL
    right_hand_given  VARCHAR(10),                      -- 'Yes' | 'No'
    vip_status        VARCHAR(30),                      -- 'Not Started' | 'In Progress' | 'Completed'

    -- Hierarchy links (nullable = structural gap)
    zone_id           VARCHAR(50)  REFERENCES zones(zone_id)  ON DELETE SET NULL,
    kcu_id            VARCHAR(50)  REFERENCES kcus(kcu_id)    ON DELETE SET NULL,

    member_status     VARCHAR(20)  NOT NULL DEFAULT 'Active',
    join_date         DATE         NOT NULL DEFAULT CURRENT_DATE,
    notes             TEXT
);

-- Index for common filter queries
CREATE INDEX IF NOT EXISTS idx_members_zone    ON members(zone_id);
CREATE INDEX IF NOT EXISTS idx_members_kcu     ON members(kcu_id);
CREATE INDEX IF NOT EXISTS idx_members_status  ON members(member_status);
CREATE INDEX IF NOT EXISTS idx_members_vip     ON members(vip_status);
CREATE INDEX IF NOT EXISTS idx_members_baptism ON members(baptism_status);
CREATE INDEX IF NOT EXISTS idx_members_join    ON members(join_date);

-- =============================================================================
-- 6. CHILDREN  (Family tree — linked to a parent Member)
-- =============================================================================
CREATE TABLE IF NOT EXISTS children (
    child_id     VARCHAR(50) PRIMARY KEY,
    parent_id    VARCHAR(50) REFERENCES members(member_id) ON DELETE CASCADE,
    child_name   VARCHAR(100),
    child_dob    DATE,
    child_gender VARCHAR(10)
);

CREATE INDEX IF NOT EXISTS idx_children_parent ON children(parent_id);

-- =============================================================================
-- 7. ATTENDANCE
--    event_type: 'KCU' | 'SUNDAY' | 'WEDNESDAY' | 'SPECIAL'
--    status:     'PRESENT' | 'ABSENT'
-- =============================================================================
CREATE TABLE IF NOT EXISTS attendance (
    att_id     VARCHAR(50) PRIMARY KEY,
    member_id  VARCHAR(50) NOT NULL REFERENCES members(member_id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    att_date   DATE        NOT NULL,
    status     VARCHAR(20) NOT NULL,

    -- Prevent duplicate records for the same member/event/date
    CONSTRAINT uq_attendance UNIQUE (member_id, event_type, att_date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_member ON attendance(member_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date   ON attendance(att_date);
CREATE INDEX IF NOT EXISTS idx_attendance_type   ON attendance(event_type);

-- =============================================================================
-- 8. FOLLOW_UPS  (Pastoral care task queue)
--    status: 'PENDING' | 'RESOLVED'
--    assigned_to_user_id: FK to users (nullable until user table exists)
-- =============================================================================
CREATE TABLE IF NOT EXISTS follow_ups (
    followup_id          VARCHAR(50)  PRIMARY KEY,
    member_id            VARCHAR(50)  NOT NULL REFERENCES members(member_id) ON DELETE CASCADE,
    reason               VARCHAR(100),
    status               VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
    assigned_to_user_id  VARCHAR(50), -- FK added after users table (see ALTER below)
    notes                TEXT,
    created_at           TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_followups_member ON follow_ups(member_id);
CREATE INDEX IF NOT EXISTS idx_followups_status ON follow_ups(status);
CREATE INDEX IF NOT EXISTS idx_followups_created ON follow_ups(created_at);

-- =============================================================================
-- 9. MEMBER_MINISTRIES  (Join table — Member ↔ Ministry)
--    Composite PK: (member_id, ministry_id)
--    priority: 1 = primary, 2 = secondary, 3 = tertiary
-- =============================================================================
CREATE TABLE IF NOT EXISTS member_ministries (
    member_id   VARCHAR(50) NOT NULL REFERENCES members(member_id)   ON DELETE CASCADE,
    ministry_id VARCHAR(50) NOT NULL REFERENCES ministries(min_id)   ON DELETE CASCADE,
    priority    INTEGER,
    PRIMARY KEY (member_id, ministry_id)
);

CREATE INDEX IF NOT EXISTS idx_mm_member   ON member_ministries(member_id);
CREATE INDEX IF NOT EXISTS idx_mm_ministry ON member_ministries(ministry_id);

-- =============================================================================
-- 10. MEMBER_COMPETENCIES  (Join table — Member ↔ Competency)
--     Composite PK: (member_id, competency_id)
-- =============================================================================
CREATE TABLE IF NOT EXISTS member_competencies (
    member_id    VARCHAR(50) NOT NULL REFERENCES members(member_id)      ON DELETE CASCADE,
    competency_id VARCHAR(50) NOT NULL REFERENCES competencies(comp_id)  ON DELETE CASCADE,
    PRIMARY KEY (member_id, competency_id)
);

CREATE INDEX IF NOT EXISTS idx_mc_member     ON member_competencies(member_id);
CREATE INDEX IF NOT EXISTS idx_mc_competency ON member_competencies(competency_id);

-- =============================================================================
-- 11. USERS  (Authentication + RBAC principal)
--     role: 'ADMIN' | 'PASTOR' | 'ZONE_LEADER' | 'KCU_LEADER'
--     assigned_zone_id / assigned_kcu_id = the RBAC data fence
-- =============================================================================
CREATE TABLE IF NOT EXISTS users (
    user_id          VARCHAR(50)  PRIMARY KEY,
    username         VARCHAR(100) NOT NULL UNIQUE,
    password_hash    VARCHAR(255) NOT NULL,
    role             VARCHAR(20)  NOT NULL,
    member_id        VARCHAR(50)  REFERENCES members(member_id) ON DELETE SET NULL,
    assigned_zone_id VARCHAR(50)  REFERENCES zones(zone_id)     ON DELETE SET NULL,
    assigned_kcu_id  VARCHAR(50)  REFERENCES kcus(kcu_id)       ON DELETE SET NULL
);

-- =============================================================================
-- 12. DEFERRED FK — follow_ups.assigned_to_user_id → users
--     Added after users table is created to avoid circular dependency.
-- =============================================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_followup_assigned_user'
    ) THEN
        ALTER TABLE follow_ups
            ADD CONSTRAINT fk_followup_assigned_user
            FOREIGN KEY (assigned_to_user_id) REFERENCES users(user_id) ON DELETE SET NULL;
    END IF;
END $$;

-- =============================================================================
-- 13. AUDIT LOG SCHEMA
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
