package com.church.cms.repository;

import com.church.cms.entity.Member;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface MemberRepository extends JpaRepository<Member, String> {

    // ── Filtered paginated list for Members Hub ──────────────────────────────
    @Query("""
            SELECT m FROM Member m
            WHERE (:zoneId   IS NULL OR m.zone.zoneId        = :zoneId)
              AND (:kcuId    IS NULL OR m.kcu.kcuId           = :kcuId)
              AND (:gender   IS NULL OR m.gender              = :gender)
              AND (:status   IS NULL OR m.memberStatus        = :status)
              AND (:marital  IS NULL OR m.maritalStatus       = :marital)
            """)
    Page<Member> findFiltered(
            @Param("zoneId")  String zoneId,
            @Param("kcuId")   String kcuId,
            @Param("gender")  String gender,
            @Param("status")  String status,
            @Param("marital") String marital,
            Pageable pageable);

    // ── Structural Gap: members with no KCU assigned ─────────────────────────
    @Query("SELECT m FROM Member m WHERE m.kcu IS NULL AND m.memberStatus = 'Active'")
    List<Member> findMembersWithNoKcu();

    @Query("SELECT m FROM Member m WHERE m.kcu IS NULL AND m.zone.zoneId = :zoneId AND m.memberStatus = 'Active'")
    List<Member> findMembersWithNoKcuByZone(@Param("zoneId") String zoneId);

    // ── New members within a date window ─────────────────────────────────────
    @Query("SELECT m FROM Member m WHERE m.joinDate >= :from AND m.joinDate <= :to")
    List<Member> findNewMembers(@Param("from") LocalDate from, @Param("to") LocalDate to);

    @Query("SELECT m FROM Member m WHERE m.joinDate >= :from AND m.joinDate <= :to AND m.zone.zoneId = :zoneId")
    List<Member> findNewMembersByZone(@Param("from") LocalDate from, @Param("to") LocalDate to, @Param("zoneId") String zoneId);

    // ── Counts ────────────────────────────────────────────────────────────────
    long countByMemberStatus(String memberStatus);

    @Query("SELECT COUNT(m) FROM Member m WHERE m.memberStatus = :status AND m.zone.zoneId = :zoneId")
    long countByStatusAndZone(@Param("status") String status, @Param("zoneId") String zoneId);

    @Query("SELECT COUNT(m) FROM Member m WHERE m.memberStatus = :status AND m.kcu.kcuId = :kcuId")
    long countByStatusAndKcu(@Param("status") String status, @Param("kcuId") String kcuId);

    // ── Salvation tracking ────────────────────────────────────────────────────
    @Query("SELECT m FROM Member m WHERE m.salvationStatus = 0 OR m.salvationDate IS NULL")
    List<Member> findMembersWithNoSalvationRecord();

    @Query("SELECT m FROM Member m WHERE m.salvationDate >= :from AND m.salvationDate <= :to")
    List<Member> findSalvationsByDateRange(@Param("from") LocalDate from, @Param("to") LocalDate to);

    // ── Baptism funnel ────────────────────────────────────────────────────────
    @Query("SELECT m FROM Member m WHERE m.baptismStatus = 'Candidate'")
    List<Member> findBaptismCandidates();

    // ── VIP status distribution ───────────────────────────────────────────────
    @Query("SELECT m.vipStatus, COUNT(m) FROM Member m GROUP BY m.vipStatus")
    List<Object[]> countByVipStatus();

    // ── LEADERSHIP ANOMALY RULE ───────────────────────────────────────────────
    // Members serving in a ministry but VIP is NOT 'Completed'
    @Query("""
            SELECT DISTINCT m FROM Member m
            WHERE EXISTS (
                SELECT 1 FROM MemberMinistry mm WHERE mm.member = m
            )
            AND (m.vipStatus IS NULL OR m.vipStatus <> 'Completed')
            AND m.memberStatus = 'Active'
            """)
    List<Member> findLeadershipAnomalies();

    @Query("""
            SELECT DISTINCT m FROM Member m
            WHERE EXISTS (
                SELECT 1 FROM MemberMinistry mm WHERE mm.member = m
            )
            AND (m.vipStatus IS NULL OR m.vipStatus <> 'Completed')
            AND m.memberStatus = 'Active'
            AND m.zone.zoneId = :zoneId
            """)
    List<Member> findLeadershipAnomaliesByZone(@Param("zoneId") String zoneId);

    @Query("""
            SELECT DISTINCT m FROM Member m
            WHERE EXISTS (
                SELECT 1 FROM MemberMinistry mm WHERE mm.member = m
            )
            AND (m.vipStatus IS NULL OR m.vipStatus <> 'Completed')
            AND m.memberStatus = 'Active'
            AND m.kcu.kcuId = :kcuId
            """)
    List<Member> findLeadershipAnomaliesByKcu(@Param("kcuId") String kcuId);

    // ── TALENT UTILIZATION SCANNER ────────────────────────────────────────────
    // Members with competencies but NOT serving in any ministry
    @Query("""
            SELECT DISTINCT m FROM Member m
            WHERE EXISTS (
                SELECT 1 FROM MemberCompetency mc WHERE mc.member = m
            )
            AND NOT EXISTS (
                SELECT 1 FROM MemberMinistry mm WHERE mm.member = m
            )
            AND m.memberStatus = 'Active'
            """)
    List<Member> findTalentedButNotServing();

    // Scoped by skill keyword
    @Query("""
            SELECT DISTINCT m FROM Member m
            WHERE EXISTS (
                SELECT 1 FROM MemberCompetency mc
                WHERE mc.member = m
                AND LOWER(mc.competency.skillName) LIKE LOWER(CONCAT('%', :skill, '%'))
            )
            AND NOT EXISTS (
                SELECT 1 FROM MemberMinistry mm WHERE mm.member = m
            )
            AND m.memberStatus = 'Active'
            """)
    List<Member> findTalentedButNotServingBySkill(@Param("skill") String skill);

    // Zone-scoped variants
    @Query("""
            SELECT DISTINCT m FROM Member m
            WHERE EXISTS (
                SELECT 1 FROM MemberCompetency mc WHERE mc.member = m
            )
            AND NOT EXISTS (
                SELECT 1 FROM MemberMinistry mm WHERE mm.member = m
            )
            AND m.memberStatus = 'Active'
            AND m.zone.zoneId = :zoneId
            """)
    List<Member> findTalentedButNotServingByZone(@Param("zoneId") String zoneId);

    @Query("""
            SELECT DISTINCT m FROM Member m
            WHERE EXISTS (
                SELECT 1 FROM MemberCompetency mc
                WHERE mc.member = m
                AND LOWER(mc.competency.skillName) LIKE LOWER(CONCAT('%', :skill, '%'))
            )
            AND NOT EXISTS (
                SELECT 1 FROM MemberMinistry mm WHERE mm.member = m
            )
            AND m.memberStatus = 'Active'
            AND m.zone.zoneId = :zoneId
            """)
    List<Member> findTalentedButNotServingBySkillAndZone(@Param("skill") String skill, @Param("zoneId") String zoneId);
}
