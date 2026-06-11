package com.church.cms.repository;

import com.church.cms.entity.Attendance;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface AttendanceRepository extends JpaRepository<Attendance, String> {

    // ── Bulk fetch for a specific event on a date ─────────────────────────────
    List<Attendance> findByEventTypeAndAttDate(String eventType, LocalDate attDate);

    // ── Attendance trend: aggregate counts per date for a given event type ────
    @Query("""
            SELECT a.attDate, COUNT(a)
            FROM Attendance a
            WHERE a.eventType = :eventType
              AND a.attDate BETWEEN :from AND :to
              AND a.status = 'PRESENT'
            GROUP BY a.attDate
            ORDER BY a.attDate
            """)
    List<Object[]> findAttendanceTrend(
            @Param("eventType") String eventType,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to);

    // ── Average attendance rate per event type ────────────────────────────────
    @Query("""
            SELECT a.eventType,
                   SUM(CASE WHEN a.status = 'PRESENT' THEN 1 ELSE 0 END) * 1.0 / COUNT(a)
            FROM Attendance a
            WHERE a.attDate BETWEEN :from AND :to
            GROUP BY a.eventType
            """)
    List<Object[]> findAverageAttendanceRates(@Param("from") LocalDate from, @Param("to") LocalDate to);

    // ── CARE TRIGGER: members absent 2+ consecutive records ──────────────────
    // Returns member IDs with 2 or more ABSENT records in the given window
    @Query("""
            SELECT a.member.memberId
            FROM Attendance a
            WHERE a.status = 'ABSENT'
              AND a.attDate >= :since
              AND a.eventType IN ('SUNDAY', 'KCU')
            GROUP BY a.member.memberId
            HAVING COUNT(a) >= 2
            """)
    List<String> findMemberIdsAbsentTwoPlusWeeks(@Param("since") LocalDate since);

    // ── Members absent for 1 full month ──────────────────────────────────────
    @Query("""
            SELECT a.member.memberId
            FROM Attendance a
            WHERE a.status = 'ABSENT'
              AND a.attDate >= :since
              AND a.eventType IN ('SUNDAY', 'KCU')
            GROUP BY a.member.memberId
            HAVING COUNT(a) >= 4
            """)
    List<String> findMemberIdsAbsentOneMonth(@Param("since") LocalDate since);

    // ── WEEKLY SCHEDULER: KCU absences in a 3-week window ────────────────────
    // Returns member IDs with 2+ ABSENT KCU records on or after :since.
    // Used by FollowUpScheduler every Sunday at 11 PM.
    @Query("""
            SELECT a.member.memberId
            FROM Attendance a
            WHERE a.status = 'ABSENT'
              AND a.eventType = 'KCU'
              AND a.attDate >= :since
            GROUP BY a.member.memberId
            HAVING COUNT(a) >= 2
            """)
    List<String> findMembersWithConsecutiveKcuAbsences(@Param("since") LocalDate since);

    // ── All attendance records for a single member (for profile drilldown) ────
    List<Attendance> findByMember_MemberIdOrderByAttDateDesc(String memberId);

    // ── KCU-scoped attendance for a date range ────────────────────────────────
    @Query("""
            SELECT a FROM Attendance a
            WHERE a.member.kcu.kcuId = :kcuId
              AND a.attDate BETWEEN :from AND :to
            """)
    List<Attendance> findByKcuAndDateRange(
            @Param("kcuId") String kcuId,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to);

    // ── Zone-scoped attendance for a date range ───────────────────────────────
    @Query("""
            SELECT a FROM Attendance a
            WHERE a.member.zone.zoneId = :zoneId
              AND a.attDate BETWEEN :from AND :to
            """)
    List<Attendance> findByZoneAndDateRange(
            @Param("zoneId") String zoneId,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to);
}
