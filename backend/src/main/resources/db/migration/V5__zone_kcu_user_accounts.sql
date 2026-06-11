-- =============================================================================
-- V5: Create login accounts for all 4 Zone Leaders and all 23 KCU Leaders
--
-- Default password for ALL accounts: password123
-- BCrypt hash of "password123":
--   $2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lh7y
--
-- Username convention:
--   Zone leaders  → zone<N>leader   (e.g. zone1leader, zone2leader)
--   KCU leaders   → kcu<ID>leader   (e.g. kcu1leader, kcu6leader)
--
-- Existing accounts U001-U004 are left untouched.
-- All inserts use ON CONFLICT DO NOTHING so re-runs are safe.
-- =============================================================================

-- ── Zone Leader accounts ──────────────────────────────────────────────────────

INSERT INTO users (user_id, username, password_hash, role, assigned_zone_id, assigned_kcu_id, member_id)
VALUES
    ('U005', 'zone1leader2', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lh7y', 'ZONE_LEADER', 'Z001', NULL, NULL),
    ('U006', 'zone2leader',  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lh7y', 'ZONE_LEADER', 'Z002', NULL, NULL),
    ('U007', 'zone3leader',  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lh7y', 'ZONE_LEADER', 'Z003', NULL, NULL),
    ('U008', 'zone4leader',  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lh7y', 'ZONE_LEADER', 'Z004', NULL, NULL)
ON CONFLICT (user_id) DO NOTHING;

-- ── KCU Leader accounts — Zone 1 (KCUs 1-5) ──────────────────────────────────

INSERT INTO users (user_id, username, password_hash, role, assigned_zone_id, assigned_kcu_id, member_id)
VALUES
    -- kcu_id=1  MihanaYeme      / Yeshi Germa
    ('U010', 'kcu1leader2', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lh7y', 'KCU_LEADER', 'Z001', 1,  NULL),
    -- kcu_id=2  Tsega           / Abebe W/Mariyam
    ('U011', 'kcu2leader',  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lh7y', 'KCU_LEADER', 'Z001', 2,  NULL),
    -- kcu_id=3  Agape           / Eliyase Garedew
    ('U012', 'kcu3leader',  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lh7y', 'KCU_LEADER', 'Z001', 3,  NULL),
    -- kcu_id=4  Not determined1 / Derje
    ('U013', 'kcu4leader',  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lh7y', 'KCU_LEADER', 'Z001', 4,  NULL),
    -- kcu_id=5  Yewetatoch      / Jani Wendwosen
    ('U014', 'kcu5leader',  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lh7y', 'KCU_LEADER', 'Z001', 5,  NULL)
ON CONFLICT (user_id) DO NOTHING;

-- ── KCU Leader accounts — Zone 2 (KCUs 6-11) ─────────────────────────────────

INSERT INTO users (user_id, username, password_hash, role, assigned_zone_id, assigned_kcu_id, member_id)
VALUES
    -- kcu_id=6  Bitaniya  / Samueal Rega
    ('U015', 'kcu6leader',  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lh7y', 'KCU_LEADER', 'Z002', 6,  NULL),
    -- kcu_id=7  Selhone   / Rahel Tadese
    ('U016', 'kcu7leader',  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lh7y', 'KCU_LEADER', 'Z002', 7,  NULL),
    -- kcu_id=8  Tsiyon    / Setotawe Selomon
    ('U017', 'kcu8leader',  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lh7y', 'KCU_LEADER', 'Z002', 8,  NULL),
    -- kcu_id=9  Aklesia   / Getu Sheferaw
    ('U018', 'kcu9leader',  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lh7y', 'KCU_LEADER', 'Z002', 9,  NULL),
    -- kcu_id=10 Yesacor1  / Yodit Arega
    ('U019', 'kcu10leader', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lh7y', 'KCU_LEADER', 'Z002', 10, NULL),
    -- kcu_id=11 Yesacor2  / Yared Gerema
    ('U020', 'kcu11leader', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lh7y', 'KCU_LEADER', 'Z002', 11, NULL)
ON CONFLICT (user_id) DO NOTHING;

-- ── KCU Leader accounts — Zone 3 (KCUs 12-16) ────────────────────────────────

INSERT INTO users (user_id, username, password_hash, role, assigned_zone_id, assigned_kcu_id, member_id)
VALUES
    -- kcu_id=12 Not determined2 / Elsabet Emesha
    ('U021', 'kcu12leader', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lh7y', 'KCU_LEADER', 'Z003', 12, NULL),
    -- kcu_id=13 Not determined3 / Kidiset Tsegaye
    ('U022', 'kcu13leader', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lh7y', 'KCU_LEADER', 'Z003', 13, NULL),
    -- kcu_id=14 Rohobot         / Tamerat Tafese
    ('U023', 'kcu14leader', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lh7y', 'KCU_LEADER', 'Z003', 14, NULL),
    -- kcu_id=15 Not determined  / Kaseche Alemayehu
    ('U024', 'kcu15leader', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lh7y', 'KCU_LEADER', 'Z003', 15, NULL),
    -- kcu_id=16 Not determined  / Mikias Befekadu
    ('U025', 'kcu16leader', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lh7y', 'KCU_LEADER', 'Z003', 16, NULL)
ON CONFLICT (user_id) DO NOTHING;

-- ── KCU Leader accounts — Zone 4 (KCUs 17-23) ────────────────────────────────

INSERT INTO users (user_id, username, password_hash, role, assigned_zone_id, assigned_kcu_id, member_id)
VALUES
    -- kcu_id=17 Tsega               / kifile W/tsadik
    ('U026', 'kcu17leader', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lh7y', 'KCU_LEADER', 'Z004', 17, NULL),
    -- kcu_id=18 Yemematsegna Ketema / saron Wedineh
    ('U027', 'kcu18leader', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lh7y', 'KCU_LEADER', 'Z004', 18, NULL),
    -- kcu_id=19 Yotor               / Alem Melaku
    ('U028', 'kcu19leader', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lh7y', 'KCU_LEADER', 'Z004', 19, NULL),
    -- kcu_id=20 Not determined4     / Miheret Lema
    ('U029', 'kcu20leader', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lh7y', 'KCU_LEADER', 'Z004', 20, NULL),
    -- kcu_id=21 Timotiyos           / Elsabet Tarekegn
    ('U030', 'kcu21leader', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lh7y', 'KCU_LEADER', 'Z004', 21, NULL),
    -- kcu_id=22 Not determined5     / Mesefin Getachew
    ('U031', 'kcu22leader', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lh7y', 'KCU_LEADER', 'Z004', 22, NULL),
    -- kcu_id=23 Not determined6     / Yared Sahal
    ('U032', 'kcu23leader', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lh7y', 'KCU_LEADER', 'Z004', 23, NULL)
ON CONFLICT (user_id) DO NOTHING;
