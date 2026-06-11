package com.church.cms.repository;

import com.church.cms.entity.FollowUp;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface FollowUpRepository extends JpaRepository<FollowUp, String> {

    // ── Worklist for a specific leader ────────────────────────────────────────
    List<FollowUp> findByAssignedTo_UserIdAndStatus(String userId, String status);

    // ── All pending follow-ups (Admin/Pastor view) ────────────────────────────
    List<FollowUp> findByStatus(String status);

    // ── Zone-scoped pending follow-ups ────────────────────────────────────────
    @Query("""
            SELECT f FROM FollowUp f
            WHERE f.member.zone.zoneId = :zoneId
              AND f.status = :status
            """)
    List<FollowUp> findByZoneAndStatus(@Param("zoneId") String zoneId, @Param("status") String status);

    // ── KCU-scoped pending follow-ups ─────────────────────────────────────────
    @Query("""
            SELECT f FROM FollowUp f
            WHERE f.member.kcu.kcuId = :kcuId
              AND f.status = :status
            """)
    List<FollowUp> findByKcuAndStatus(@Param("kcuId") String kcuId, @Param("status") String status);

    // ── Leader response diagnostic: not contacted within 72 hours ────────────
    @Query("""
            SELECT f FROM FollowUp f
            WHERE f.status = 'PENDING'
              AND f.createdAt <= :cutoff
            """)
    List<FollowUp> findPendingOlderThan(@Param("cutoff") LocalDateTime cutoff);

    // ── Completion rate per leader: [userId, resolved, total] ────────────────
    @Query("""
            SELECT f.assignedTo.userId,
                   SUM(CASE WHEN f.status = 'RESOLVED' THEN 1 ELSE 0 END),
                   COUNT(f)
            FROM FollowUp f
            GROUP BY f.assignedTo.userId
            """)
    List<Object[]> findCompletionRatePerLeader();

    // ── Check if a pending follow-up already exists for a member ─────────────
    boolean existsByMember_MemberIdAndStatus(String memberId, String status);
}
