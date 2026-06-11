-- =============================================================================
-- V4: Convert kcus.kcu_id from VARCHAR(50) to BIGSERIAL (auto-increment)
--     and fix all FK references in members and users.
--
-- Strategy:
--   1. Drop FK constraints on members and users that reference kcus(kcu_id)
--   2. Drop the old VARCHAR kcu_id FK columns on members and users
--   3. Drop and recreate the kcus table with BIGSERIAL primary key
--   4. Re-insert the V2 seed KCUs with explicit numeric IDs (1-8) so that
--      the sequence starts at 9 for new rows — preserving referential integrity
--   5. Re-add kcu_id FK columns on members and users as BIGINT
--   6. Restore the member→kcu and user→kcu FK links using the known numeric IDs
--   7. Restore indexes
-- =============================================================================

-- ── 1. Drop FK constraints on referencing tables ──────────────────────────────
ALTER TABLE members DROP CONSTRAINT IF EXISTS members_kcu_id_fkey;
ALTER TABLE users   DROP CONSTRAINT IF EXISTS users_assigned_kcu_id_fkey;

-- ── 2. Drop old kcu_id FK columns on referencing tables ──────────────────────
ALTER TABLE members DROP COLUMN IF EXISTS kcu_id;
ALTER TABLE users   DROP COLUMN IF EXISTS assigned_kcu_id;

-- ── 3. Recreate kcus with a BIGSERIAL primary key ─────────────────────────────
DROP TABLE IF EXISTS kcus CASCADE;

CREATE TABLE kcus (
    kcu_id          BIGSERIAL    PRIMARY KEY,
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

-- ── 4. Re-insert the 8 V2 seed KCUs with explicit numeric IDs ────────────────
--    Using OVERRIDING SYSTEM VALUE so we can set the BIGSERIAL value explicitly.
--    The sequence will be advanced past 8 so new rows start at 9.
INSERT INTO kcus (kcu_id, zone_id, kcu_name, kcu_type, kcu_leader, assistant, leader_phone, assistant_phone, meeting_day, meeting_time, location)
OVERRIDING SYSTEM VALUE
VALUES
    (1, 'Z001', 'Bole Alpha Cell',       'GENERAL',     'Abebe Girma',       'Tigist Haile',     '0911100001', '0911100002', 'Tuesday',   '18:30', 'Bole, Addis Ababa'),
    (2, 'Z001', 'Bole Young Adults',     'YOUNG_ADULT', 'Dawit Tesfaye',     'Sara Bekele',      '0911100003', '0911100004', 'Thursday',  '19:00', 'Bole, Addis Ababa'),
    (3, 'Z002', 'Kirkos Faithful Cell',  'GENERAL',     'Mekdes Alemu',      'Yonas Tadesse',    '0911200001', '0911200002', 'Wednesday', '18:00', 'Kirkos, Addis Ababa'),
    (4, 'Z002', 'Kirkos Youth Cell',     'YOUNG_ADULT', 'Hana Worku',        'Bereket Assefa',   '0911200003', '0911200004', 'Friday',    '18:30', 'Kirkos, Addis Ababa'),
    (5, 'Z003', 'Yeka Grace Cell',       'GENERAL',     'Solomon Negash',    'Almaz Teshome',    '0911300001', '0911300002', 'Tuesday',   '19:00', 'Yeka, Addis Ababa'),
    (6, 'Z003', 'Yeka New Generation',   'YOUNG_ADULT', 'Natnael Girma',     'Bethlehem Hailu',  '0911300003', '0911300004', 'Saturday',  '10:00', 'Yeka, Addis Ababa'),
    (7, 'Z004', 'Nifas Silk Zion Cell',  'GENERAL',     'Tsehay Bekele',     'Mulugeta Desta',   '0911400001', '0911400002', 'Wednesday', '19:00', 'Nifas Silk, Addis Ababa'),
    (8, 'Z004', 'Nifas Silk Youth Cell', 'YOUNG_ADULT', 'Eyerusalem Tefera', 'Robel Haile',      '0911400003', '0911400004', 'Thursday',  '18:00', 'Nifas Silk, Addis Ababa');

-- Advance the sequence so the next auto-assigned ID starts at 9
SELECT setval('kcus_kcu_id_seq', 8, true);

-- ── 5. Re-add kcu_id FK columns on referencing tables as BIGINT ───────────────
ALTER TABLE members ADD COLUMN kcu_id BIGINT REFERENCES kcus(kcu_id) ON DELETE SET NULL;
ALTER TABLE users   ADD COLUMN assigned_kcu_id BIGINT REFERENCES kcus(kcu_id) ON DELETE SET NULL;

-- ── 6. Restore member→kcu links using the known numeric IDs ──────────────────
--    These mirror the V2 seed assignments (KCU001=1, KCU002=2, etc.)
UPDATE members SET kcu_id = 1 WHERE member_id = 'M001';
UPDATE members SET kcu_id = 2 WHERE member_id = 'M002';
UPDATE members SET kcu_id = 2 WHERE member_id = 'M003';
UPDATE members SET kcu_id = 4 WHERE member_id = 'M004';
UPDATE members SET kcu_id = 4 WHERE member_id = 'M005';
-- M006: kcu_id intentionally NULL (GAP test case)
-- M007: kcu_id intentionally NULL (GAP test case)
UPDATE members SET kcu_id = 3 WHERE member_id = 'M008';
UPDATE members SET kcu_id = 6 WHERE member_id = 'M009';
UPDATE members SET kcu_id = 6 WHERE member_id = 'M010';
UPDATE members SET kcu_id = 5 WHERE member_id = 'M011';
UPDATE members SET kcu_id = 5 WHERE member_id = 'M012';

-- ── 7. Restore user→kcu links ─────────────────────────────────────────────────
--    U004 (kcu1leader) was assigned to KCU001 → now numeric ID 1
UPDATE users SET assigned_kcu_id = 1 WHERE user_id = 'U004';

-- ── 8. Restore indexes ────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_members_kcu ON members(kcu_id);
