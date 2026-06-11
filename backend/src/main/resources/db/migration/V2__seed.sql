-- =============================================================================
-- Church Management System — Seed Data (V2__seed.sql)
-- Flyway migration V2 — runs once after V1__init.sql
--
-- SEED STRATEGY:
--   All inserts use ON CONFLICT DO NOTHING so re-runs are safe.
--   Insertion order respects FK dependencies:
--     zones → kcus → ministries → competencies → members
--     → children → member_ministries → member_competencies
--     → attendance → follow_ups → users
--
-- ANALYTICS TEST TARGETS (clearly marked):
--   [ANOMALY]  Member serving in ministry but VIP ≠ 'Completed'
--              → triggers Leadership Anomaly Rule
--   [TALENT]   Member with competencies but NO ministry assignment
--              → triggers Talent Utilization Scanner
--   [GAP]      Member with no KCU assigned
--              → triggers Structural Gap report
--   [CARE]     Member with 2+ ABSENT records
--              → triggers Care Engine / FollowUp auto-creation
-- =============================================================================


-- =============================================================================
-- 1. ZONES  (4 real zones from the original spreadsheet)
-- =============================================================================
INSERT INTO zones (zone_id, zone_name, zone_leader, phone)
VALUES
    ('Z001', 'Zone 1', 'Kidiset W/Hariyat',    '0911654565'),
    ('Z002', 'Zone 2', 'Yewalashet Shenegelgn', '0911656003'),
    ('Z003', 'Zone 3', 'Tewoderos Kinfe',       '0911905434'),
    ('Z004', 'Zone 4', 'Beferdu Fikere',        '0911629742')
ON CONFLICT (zone_id) DO NOTHING;


-- =============================================================================
-- 2. KCUS  (8 home cells — mix of GENERAL and YOUNG_ADULT types)
-- =============================================================================
INSERT INTO kcus (kcu_id, zone_id, kcu_name, kcu_type, kcu_leader, assistant, leader_phone, assistant_phone, meeting_day, meeting_time, location)
VALUES
    -- Zone 1 KCUs
    ('KCU001', 'Z001', 'Bole Alpha Cell',       'GENERAL',     'Abebe Girma',      'Tigist Haile',    '0911100001', '0911100002', 'Tuesday',   '18:30', 'Bole, Addis Ababa'),
    ('KCU002', 'Z001', 'Bole Young Adults',     'YOUNG_ADULT', 'Dawit Tesfaye',    'Sara Bekele',     '0911100003', '0911100004', 'Thursday',  '19:00', 'Bole, Addis Ababa'),

    -- Zone 2 KCUs
    ('KCU003', 'Z002', 'Kirkos Faithful Cell',  'GENERAL',     'Mekdes Alemu',     'Yonas Tadesse',   '0911200001', '0911200002', 'Wednesday', '18:00', 'Kirkos, Addis Ababa'),
    ('KCU004', 'Z002', 'Kirkos Youth Cell',     'YOUNG_ADULT', 'Hana Worku',       'Bereket Assefa',  '0911200003', '0911200004', 'Friday',    '18:30', 'Kirkos, Addis Ababa'),

    -- Zone 3 KCUs
    ('KCU005', 'Z003', 'Yeka Grace Cell',       'GENERAL',     'Solomon Negash',   'Almaz Teshome',   '0911300001', '0911300002', 'Tuesday',   '19:00', 'Yeka, Addis Ababa'),
    ('KCU006', 'Z003', 'Yeka New Generation',   'YOUNG_ADULT', 'Natnael Girma',    'Bethlehem Hailu', '0911300003', '0911300004', 'Saturday',  '10:00', 'Yeka, Addis Ababa'),

    -- Zone 4 KCUs
    ('KCU007', 'Z004', 'Nifas Silk Zion Cell',  'GENERAL',     'Tsehay Bekele',    'Mulugeta Desta',  '0911400001', '0911400002', 'Wednesday', '19:00', 'Nifas Silk, Addis Ababa'),
    ('KCU008', 'Z004', 'Nifas Silk Youth Cell', 'YOUNG_ADULT', 'Eyerusalem Tefera','Robel Haile',     '0911400003', '0911400004', 'Thursday',  '18:00', 'Nifas Silk, Addis Ababa')
ON CONFLICT (kcu_id) DO NOTHING;


-- =============================================================================
-- 3. MINISTRIES  (Full 13-ministry catalogue — MIN01 through MIN13)
-- =============================================================================
INSERT INTO ministries (min_id, name_am, name_en)
VALUES
    ('MIN01', 'የልጆች አገልግሎት',        'Children Ministry'),
    ('MIN02', 'የወጣቶች አገልግሎት',       'Youth Ministry'),
    ('MIN03', 'የወንዶች አገልግሎት',       'Men Ministry'),
    ('MIN04', 'የሴቶች አገልግሎት',        'Women Ministry'),
    ('MIN05', 'የምስጋና አገልግሎት',       'Worship Ministry'),
    ('MIN06', 'የሚዲያ አገልግሎት',        'Media Ministry'),
    ('MIN07', 'የድምፅ አገልግሎት',        'Sound Engineering Ministry'),
    ('MIN08', 'የጸሎት አገልግሎት',        'Prayer Ministry'),
    ('MIN09', 'የስብከት አገልግሎት',       'Preaching Ministry'),
    ('MIN10', 'የአቀባበል አገልግሎት',      'Ushering Ministry'),
    ('MIN11', 'የምክር አገልግሎት',        'Counseling Ministry'),
    ('MIN12', 'የምጽዋት አገልግሎት',       'Welfare Ministry'),
    ('MIN13', 'የቴክኖሎጂ አገልግሎት',      'Technology Ministry')
ON CONFLICT (min_id) DO NOTHING;


-- =============================================================================
-- 4. COMPETENCIES  (Skill/talent catalogue)
-- =============================================================================
INSERT INTO competencies (comp_id, skill_name)
VALUES
    ('COMP01', 'Music'),
    ('COMP02', 'Video Editing'),
    ('COMP03', 'Sound Engineering'),
    ('COMP04', 'Teaching'),
    ('COMP05', 'Graphic Design'),
    ('COMP06', 'Photography'),
    ('COMP07', 'Web Development'),
    ('COMP08', 'Counseling'),
    ('COMP09', 'Event Planning'),
    ('COMP10', 'Translation / Interpretation')
ON CONFLICT (comp_id) DO NOTHING;


-- =============================================================================
-- 5. MEMBERS
--    12 members covering every analytics test scenario.
-- =============================================================================

-- ── M001: Fully complete member (baseline — no anomalies) ────────────────────
INSERT INTO members (member_id, full_name, phone, gender, birth_date, marital_status,
    salvation_status, salvation_date, baptism_status, right_hand_given, vip_status,
    zone_id, kcu_id, member_status, join_date)
VALUES ('M001', 'Abebe Girma', '0911100001', 'Male', '1985-03-15', 'Married',
    1, '2010-06-01', 'Baptized', 'Yes', 'Completed',
    'Z001', 'KCU001', 'Active', '2010-06-01')
ON CONFLICT (member_id) DO NOTHING;

-- ── M002: [ANOMALY] Serving in Worship Ministry but VIP = 'In Progress' ──────
INSERT INTO members (member_id, full_name, phone, gender, birth_date, marital_status,
    salvation_status, salvation_date, baptism_status, right_hand_given, vip_status,
    zone_id, kcu_id, member_status, join_date)
VALUES ('M002', 'Dawit Tesfaye', '0911100003', 'Male', '1992-07-22', 'Single',
    1, '2015-03-10', 'Baptized', 'Yes', 'In Progress',
    'Z001', 'KCU002', 'Active', '2015-03-10')
ON CONFLICT (member_id) DO NOTHING;

-- ── M003: [ANOMALY] Serving in Media Ministry but VIP = 'Not Started' ────────
INSERT INTO members (member_id, full_name, phone, gender, birth_date, marital_status,
    salvation_status, salvation_date, baptism_status, right_hand_given, vip_status,
    zone_id, kcu_id, member_status, join_date)
VALUES ('M003', 'Sara Bekele', '0911100004', 'Female', '1998-11-05', 'Single',
    1, '2019-01-20', 'Baptized', 'Yes', 'Not Started',
    'Z001', 'KCU002', 'Active', '2019-01-20')
ON CONFLICT (member_id) DO NOTHING;

-- ── M004: [TALENT] Has Music + Video Editing skills but NOT serving anywhere ──
INSERT INTO members (member_id, full_name, phone, gender, birth_date, marital_status,
    salvation_status, salvation_date, baptism_status, right_hand_given, vip_status,
    zone_id, kcu_id, member_status, join_date)
VALUES ('M004', 'Hana Worku', '0911200003', 'Female', '1996-04-18', 'Single',
    1, '2018-05-12', 'Baptized', 'Yes', 'Completed',
    'Z002', 'KCU004', 'Active', '2018-05-12')
ON CONFLICT (member_id) DO NOTHING;

-- ── M005: [TALENT] Has Sound Engineering + Teaching skills but NOT serving ────
INSERT INTO members (member_id, full_name, phone, gender, birth_date, marital_status,
    salvation_status, salvation_date, baptism_status, right_hand_given, vip_status,
    zone_id, kcu_id, member_status, join_date)
VALUES ('M005', 'Bereket Assefa', '0911200004', 'Male', '1990-09-30', 'Married',
    1, '2012-08-15', 'Baptized', 'Yes', 'Completed',
    'Z002', 'KCU004', 'Active', '2012-08-15')
ON CONFLICT (member_id) DO NOTHING;

-- ── M006: [GAP] Active member with NO KCU assigned ───────────────────────────
INSERT INTO members (member_id, full_name, phone, gender, birth_date, marital_status,
    salvation_status, salvation_date, baptism_status, right_hand_given, vip_status,
    zone_id, kcu_id, member_status, join_date)
VALUES ('M006', 'Tigist Haile', '0911100002', 'Female', '1988-12-01', 'Married',
    1, '2011-02-14', 'Baptized', 'Yes', 'Completed',
    'Z001', NULL, 'Active', '2011-02-14')
ON CONFLICT (member_id) DO NOTHING;

-- ── M007: [GAP] Newly registered — no zone, no KCU ───────────────────────────
INSERT INTO members (member_id, full_name, phone, gender, birth_date, marital_status,
    salvation_status, salvation_date, baptism_status, right_hand_given, vip_status,
    zone_id, kcu_id, member_status, join_date)
VALUES ('M007', 'Yonas Tadesse', '0911200002', 'Male', '2000-06-25', 'Single',
    1, '2024-11-03', 'Candidate', 'No', 'Not Started',
    NULL, NULL, 'Active', '2024-11-03')
ON CONFLICT (member_id) DO NOTHING;

-- ── M008: [CARE] Member with 2+ ABSENT records ────────────────────────────────
INSERT INTO members (member_id, full_name, phone, gender, birth_date, marital_status,
    salvation_status, salvation_date, baptism_status, right_hand_given, vip_status,
    zone_id, kcu_id, member_status, join_date)
VALUES ('M008', 'Mekdes Alemu', '0911200001', 'Female', '1993-02-08', 'Single',
    1, '2016-04-17', 'Baptized', 'Yes', 'In Progress',
    'Z002', 'KCU003', 'Active', '2016-04-17')
ON CONFLICT (member_id) DO NOTHING;

-- ── M009: Baptism Candidate ───────────────────────────────────────────────────
INSERT INTO members (member_id, full_name, phone, gender, birth_date, marital_status,
    salvation_status, salvation_date, baptism_status, right_hand_given, vip_status,
    zone_id, kcu_id, member_status, join_date)
VALUES ('M009', 'Natnael Girma', '0911300003', 'Male', '2001-08-14', 'Single',
    1, '2025-01-19', 'Candidate', 'No', 'Not Started',
    'Z003', 'KCU006', 'Active', '2025-01-19')
ON CONFLICT (member_id) DO NOTHING;

-- ── M010: New member this month ───────────────────────────────────────────────
INSERT INTO members (member_id, full_name, phone, gender, birth_date, marital_status,
    salvation_status, salvation_date, baptism_status, right_hand_given, vip_status,
    zone_id, kcu_id, member_status, join_date)
VALUES ('M010', 'Bethlehem Hailu', '0911300004', 'Female', '2003-05-02', 'Single',
    1, '2026-05-10', 'Candidate', 'No', 'Not Started',
    'Z003', 'KCU006', 'Active', '2026-05-10')
ON CONFLICT (member_id) DO NOTHING;

-- ── M011: Married couple — spouse link demo ───────────────────────────────────
INSERT INTO members (member_id, full_name, phone, gender, birth_date, marital_status,
    salvation_status, salvation_date, baptism_status, right_hand_given, vip_status,
    zone_id, kcu_id, member_status, join_date)
VALUES ('M011', 'Solomon Negash', '0911300001', 'Male', '1980-01-20', 'Married',
    1, '2005-09-11', 'Baptized', 'Yes', 'Completed',
    'Z003', 'KCU005', 'Active', '2005-09-11')
ON CONFLICT (member_id) DO NOTHING;

INSERT INTO members (member_id, full_name, phone, gender, birth_date, marital_status,
    partner_member_id,
    salvation_status, salvation_date, baptism_status, right_hand_given, vip_status,
    zone_id, kcu_id, member_status, join_date)
VALUES ('M012', 'Almaz Teshome', '0911300002', 'Female', '1983-07-07', 'Married',
    'M011',
    1, '2005-09-11', 'Baptized', 'Yes', 'Completed',
    'Z003', 'KCU005', 'Active', '2005-09-11')
ON CONFLICT (member_id) DO NOTHING;

-- Back-fill M011's partner link now that M012 exists
UPDATE members SET partner_member_id = 'M012' WHERE member_id = 'M011' AND partner_member_id IS NULL;


-- =============================================================================
-- 6. CHILDREN  (Family tree for M011/M012 couple)
-- =============================================================================
INSERT INTO children (child_id, parent_id, child_name, child_dob, child_gender)
VALUES
    ('CH001', 'M011', 'Yohannes Solomon', '2008-03-15', 'Male'),
    ('CH002', 'M011', 'Ruth Solomon',     '2011-09-22', 'Female')
ON CONFLICT (child_id) DO NOTHING;


-- =============================================================================
-- 7. MEMBER_MINISTRIES
-- =============================================================================
INSERT INTO member_ministries (member_id, ministry_id, priority)
VALUES
    ('M001', 'MIN01', 1),   -- Abebe: Children Ministry (compliant)
    ('M002', 'MIN05', 1),   -- Dawit: Worship Ministry  [ANOMALY]
    ('M003', 'MIN06', 1),   -- Sara:  Media Ministry    [ANOMALY]
    ('M011', 'MIN08', 1),   -- Solomon: Prayer Ministry (compliant)
    ('M012', 'MIN04', 1)    -- Almaz: Women Ministry    (compliant)
ON CONFLICT (member_id, ministry_id) DO NOTHING;


-- =============================================================================
-- 8. MEMBER_COMPETENCIES
-- =============================================================================
INSERT INTO member_competencies (member_id, competency_id)
VALUES
    ('M004', 'COMP01'),   -- Hana: Music
    ('M004', 'COMP02'),   -- Hana: Video Editing
    ('M005', 'COMP03'),   -- Bereket: Sound Engineering
    ('M005', 'COMP04'),   -- Bereket: Teaching
    ('M001', 'COMP04'),   -- Abebe: Teaching (serving in MIN01)
    ('M002', 'COMP01')    -- Dawit: Music (serving in MIN05)
ON CONFLICT (member_id, competency_id) DO NOTHING;


-- =============================================================================
-- 9. ATTENDANCE
-- =============================================================================

-- M008 [CARE TARGET] — 3 consecutive absences
INSERT INTO attendance (att_id, member_id, event_type, att_date, status)
VALUES
    ('ATT001', 'M008', 'SUNDAY', CURRENT_DATE - INTERVAL '14 days', 'ABSENT'),
    ('ATT002', 'M008', 'KCU',    CURRENT_DATE - INTERVAL '11 days', 'ABSENT'),
    ('ATT003', 'M008', 'SUNDAY', CURRENT_DATE - INTERVAL '7 days',  'ABSENT')
ON CONFLICT (member_id, event_type, att_date) DO NOTHING;

-- M001 — regular attender (baseline data)
INSERT INTO attendance (att_id, member_id, event_type, att_date, status)
VALUES
    ('ATT004', 'M001', 'SUNDAY',    CURRENT_DATE - INTERVAL '14 days', 'PRESENT'),
    ('ATT005', 'M001', 'KCU',       CURRENT_DATE - INTERVAL '11 days', 'PRESENT'),
    ('ATT006', 'M001', 'SUNDAY',    CURRENT_DATE - INTERVAL '7 days',  'PRESENT'),
    ('ATT007', 'M001', 'WEDNESDAY', CURRENT_DATE - INTERVAL '10 days', 'PRESENT')
ON CONFLICT (member_id, event_type, att_date) DO NOTHING;

-- M002 — mostly present
INSERT INTO attendance (att_id, member_id, event_type, att_date, status)
VALUES
    ('ATT008', 'M002', 'SUNDAY', CURRENT_DATE - INTERVAL '14 days', 'PRESENT'),
    ('ATT009', 'M002', 'SUNDAY', CURRENT_DATE - INTERVAL '7 days',  'PRESENT'),
    ('ATT010', 'M002', 'KCU',    CURRENT_DATE - INTERVAL '11 days', 'ABSENT')
ON CONFLICT (member_id, event_type, att_date) DO NOTHING;

-- M011 — regular attender
INSERT INTO attendance (att_id, member_id, event_type, att_date, status)
VALUES
    ('ATT011', 'M011', 'SUNDAY', CURRENT_DATE - INTERVAL '14 days', 'PRESENT'),
    ('ATT012', 'M011', 'SUNDAY', CURRENT_DATE - INTERVAL '7 days',  'PRESENT'),
    ('ATT013', 'M011', 'KCU',    CURRENT_DATE - INTERVAL '11 days', 'PRESENT')
ON CONFLICT (member_id, event_type, att_date) DO NOTHING;

-- M009 — new member, one attendance
INSERT INTO attendance (att_id, member_id, event_type, att_date, status)
VALUES
    ('ATT014', 'M009', 'SUNDAY', CURRENT_DATE - INTERVAL '7 days', 'PRESENT')
ON CONFLICT (member_id, event_type, att_date) DO NOTHING;


-- =============================================================================
-- 10. USERS  (System accounts for all 4 RBAC roles)
--
--     All passwords are BCrypt hash of: password
--     Hash: $2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi
-- =============================================================================
INSERT INTO users (user_id, username, password_hash, role, member_id, assigned_zone_id, assigned_kcu_id)
VALUES
    ('U001', 'admin',
     '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
     'ADMIN', NULL, NULL, NULL),

    ('U002', 'pastor',
     '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
     'PASTOR', NULL, NULL, NULL),

    ('U003', 'zone1leader',
     '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
     'ZONE_LEADER', 'M001', 'Z001', NULL),

    ('U004', 'kcu1leader',
     '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
     'KCU_LEADER', 'M001', 'Z001', 'KCU001')
ON CONFLICT (user_id) DO NOTHING;


-- =============================================================================
-- 11. FOLLOW_UPS  (One pre-seeded care case for the worklist demo)
-- =============================================================================
INSERT INTO follow_ups (followup_id, member_id, reason, status, assigned_to_user_id, notes, created_at)
VALUES
    ('FU001', 'M008', 'Absent 2+ Weeks', 'PENDING', 'U004',
     'Member has not attended Sunday service or KCU for 3 consecutive sessions.',
     NOW() - INTERVAL '4 days')
ON CONFLICT (followup_id) DO NOTHING;
