package com.church.cms.service;

import com.church.cms.dto.member.MemberSummaryDTO;
import com.church.cms.dto.report.*;
import com.church.cms.entity.Member;
import com.church.cms.repository.*;
import com.church.cms.security.SecurityContextHelper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ReportService {

    private final MemberRepository memberRepository;
    private final AttendanceRepository attendanceRepository;
    private final FollowUpRepository followUpRepository;
    private final MemberMinistryRepository memberMinistryRepository;
    private final MemberCompetencyRepository memberCompetencyRepository;
    private final SecurityContextHelper securityContextHelper;

    // ═══════════════════════════════════════════════════════════════════════════
    // CATEGORY A — MEMBERSHIP HEALTH
    // ═══════════════════════════════════════════════════════════════════════════

    public MembershipReportDTO getMembershipReport() {
        String role   = securityContextHelper.getCurrentUserRole();
        String zoneId = securityContextHelper.getCurrentUserZoneId();
        String kcuId  = securityContextHelper.getCurrentUserKcuId();

        LocalDate now           = LocalDate.now();
        LocalDate startOfMonth  = now.withDayOfMonth(1);
        LocalDate startOfQuarter = now.withMonth(((now.getMonthValue() - 1) / 3) * 3 + 1).withDayOfMonth(1);
        LocalDate startOfYear   = now.withDayOfYear(1);

        // Total counts — scoped by role
        long totalActive   = countActive(role, zoneId, kcuId, "Active");
        long totalInactive = countActive(role, zoneId, kcuId, "Inactive");

        // New members in sliding windows
        long newThisMonth   = countNew(role, zoneId, startOfMonth, now);
        long newThisQuarter = countNew(role, zoneId, startOfQuarter, now);
        long newThisYear    = countNew(role, zoneId, startOfYear, now);

        // Structural gap
        List<Member> noKcuMembers = "ZONE_LEADER".equals(role)
                ? memberRepository.findMembersWithNoKcuByZone(zoneId)
                : memberRepository.findMembersWithNoKcu();

        // All active members for distribution analysis
        List<Member> allActive = getAllActiveMembers(role, zoneId, kcuId);

        return new MembershipReportDTO(
                totalActive,
                totalInactive,
                newThisMonth,
                newThisQuarter,
                newThisYear,
                noKcuMembers.size(),
                buildGenderDistribution(allActive),
                buildAgeDistribution(allActive),
                buildMaritalDistribution(allActive),
                buildLocationDistribution(allActive)
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // CATEGORY B — ATTENDANCE & ENGAGEMENT
    // ═══════════════════════════════════════════════════════════════════════════

    public AttendanceReportDTO getAttendanceReport(LocalDate from, LocalDate to) {
        // Average rates per event type
        List<Object[]> rateRows = attendanceRepository.findAverageAttendanceRates(from, to);
        Map<String, Double> rates = new LinkedHashMap<>();
        for (Object[] row : rateRows) {
            rates.put((String) row[0], ((Number) row[1]).doubleValue());
        }

        // Weekly trend for Sunday service
        List<Object[]> trendRows = attendanceRepository.findAttendanceTrend("SUNDAY", from, to);
        List<AttendanceReportDTO.TrendPoint> trend = trendRows.stream()
                .map(r -> new AttendanceReportDTO.TrendPoint(r[0].toString(), ((Number) r[1]).longValue()))
                .toList();

        // Care alert: absent 2+ weeks
        LocalDate twoWeeksAgo = LocalDate.now().minusWeeks(2);
        List<String> absent2Ids = attendanceRepository.findMemberIdsAbsentTwoPlusWeeks(twoWeeksAgo);
        List<MemberSummaryDTO> absent2Members = absent2Ids.stream()
                .map(id -> memberRepository.findById(id).orElse(null))
                .filter(Objects::nonNull)
                .map(this::toSummary)
                .toList();

        // High-risk: absent 1 month
        LocalDate oneMonthAgo = LocalDate.now().minusMonths(1);
        List<String> absent1MIds = attendanceRepository.findMemberIdsAbsentOneMonth(oneMonthAgo);
        List<MemberSummaryDTO> absent1Members = absent1MIds.stream()
                .map(id -> memberRepository.findById(id).orElse(null))
                .filter(Objects::nonNull)
                .map(this::toSummary)
                .toList();

        return new AttendanceReportDTO(rates, trend, absent2Members, absent1Members);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // CATEGORY D — SPIRITUAL GROWTH & LEADERSHIP ANOMALY ENGINE
    // ═══════════════════════════════════════════════════════════════════════════

    public SpiritualReportDTO getSpiritualReport() {
        String role   = securityContextHelper.getCurrentUserRole();
        String zoneId = securityContextHelper.getCurrentUserZoneId();

        List<Member> allActive = getAllActiveMembers(role, zoneId, null);

        long withSalvation    = allActive.stream().filter(m -> m.getSalvationStatus() != null && m.getSalvationStatus() == 1).count();
        long withoutSalvation = allActive.size() - withSalvation;
        long baptized         = allActive.stream().filter(m -> "Baptized".equals(m.getBaptismStatus())).count();
        long notBaptized      = allActive.size() - baptized;
        long candidates       = allActive.stream().filter(m -> "Candidate".equals(m.getBaptismStatus())).count();

        // Salvations grouped by month
        Map<String, Long> salvationsByMonth = allActive.stream()
                .filter(m -> m.getSalvationDate() != null)
                .collect(Collectors.groupingBy(
                        m -> m.getSalvationDate().format(DateTimeFormatter.ofPattern("yyyy-MM")),
                        TreeMap::new,
                        Collectors.counting()));

        // VIP distribution
        List<Object[]> vipRows = memberRepository.countByVipStatus();
        Map<String, Long> vipDist = new LinkedHashMap<>();
        for (Object[] row : vipRows) {
            String key = row[0] != null ? (String) row[0] : "Not Started";
            vipDist.put(key, ((Number) row[1]).longValue());
        }

        // ── LEADERSHIP ANOMALY RULE ───────────────────────────────────────────
        List<Member> anomalies = "ZONE_LEADER".equals(role)
                ? memberRepository.findLeadershipAnomaliesByZone(zoneId)
                : "KCU_LEADER".equals(role)
                    ? memberRepository.findLeadershipAnomaliesByKcu(securityContextHelper.getCurrentUserKcuId())
                    : memberRepository.findLeadershipAnomalies();

        List<LeadershipAnomalyDTO> anomalyDTOs = anomalies.stream()
                .map(m -> {
                    List<String> ministryNames = memberMinistryRepository
                            .findByMember_MemberId(m.getMemberId())
                            .stream()
                            .map(mm -> mm.getMinistry().getNameEn())
                            .toList();
                    return new LeadershipAnomalyDTO(
                            m.getMemberId(),
                            m.getFullName(),
                            m.getPhone(),
                            m.getVipStatus() != null ? m.getVipStatus() : "Not Started",
                            m.getZone() != null ? m.getZone().getZoneName() : null,
                            m.getKcu()  != null ? m.getKcu().getKcuName()  : null,
                            ministryNames
                    );
                }).toList();

        return new SpiritualReportDTO(
                withSalvation, withoutSalvation, salvationsByMonth,
                baptized, notBaptized, candidates,
                vipDist, anomalyDTOs
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // CATEGORY E — TALENT UTILIZATION SCANNER
    // ═══════════════════════════════════════════════════════════════════════════

    public TalentReportDTO getTalentReport(String skillFilter) {
        String role   = securityContextHelper.getCurrentUserRole();
        String zoneId = securityContextHelper.getCurrentUserZoneId();

        // Ministry densities
        List<Object[]> densityRows = "ZONE_LEADER".equals(role)
                ? memberMinistryRepository.findMinistryDensitiesByZone(zoneId)
                : memberMinistryRepository.findMinistryDensities();

        Map<String, Long> densities = new LinkedHashMap<>();
        for (Object[] row : densityRows) {
            densities.put((String) row[1], ((Number) row[2]).longValue());
        }

        // ── TALENT UTILIZATION SCANNER ────────────────────────────────────────
        List<Member> undeployed;
        boolean hasSkillFilter = skillFilter != null && !skillFilter.isBlank();

        if ("ZONE_LEADER".equals(role)) {
            undeployed = hasSkillFilter
                    ? memberRepository.findTalentedButNotServingBySkillAndZone(skillFilter, zoneId)
                    : memberRepository.findTalentedButNotServingByZone(zoneId);
        } else {
            undeployed = hasSkillFilter
                    ? memberRepository.findTalentedButNotServingBySkill(skillFilter)
                    : memberRepository.findTalentedButNotServing();
        }

        List<TalentScanDTO> talentDTOs = undeployed.stream()
                .map(m -> {
                    List<String> skills = memberCompetencyRepository
                            .findByMember_MemberId(m.getMemberId())
                            .stream()
                            .map(mc -> mc.getCompetency().getSkillName())
                            .toList();
                    return new TalentScanDTO(
                            m.getMemberId(),
                            m.getFullName(),
                            m.getPhone(),
                            m.getZone() != null ? m.getZone().getZoneName() : null,
                            m.getKcu()  != null ? m.getKcu().getKcuName()  : null,
                            skills
                    );
                }).toList();

        return new TalentReportDTO(densities, talentDTOs);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // DASHBOARD KPIs — aggregated summary for the unified dashboard
    // ═══════════════════════════════════════════════════════════════════════════

    public com.church.cms.dto.dashboard.DashboardKpiDTO getDashboardKpis() {
        String role   = securityContextHelper.getCurrentUserRole();
        String zoneId = securityContextHelper.getCurrentUserZoneId();
        String kcuId  = securityContextHelper.getCurrentUserKcuId();

        LocalDate startOfMonth = LocalDate.now().withDayOfMonth(1);

        long totalActive     = countActive(role, zoneId, kcuId, "Active");
        long newThisMonth    = countNew(role, zoneId, startOfMonth, LocalDate.now());
        long pendingFollowUps = followUpRepository.findByStatus("PENDING").size();

        List<Member> noKcu = "ZONE_LEADER".equals(role)
                ? memberRepository.findMembersWithNoKcuByZone(zoneId)
                : memberRepository.findMembersWithNoKcu();

        List<Member> anomalies = "ZONE_LEADER".equals(role)
                ? memberRepository.findLeadershipAnomaliesByZone(zoneId)
                : "KCU_LEADER".equals(role)
                    ? memberRepository.findLeadershipAnomaliesByKcu(kcuId)
                    : memberRepository.findLeadershipAnomalies();

        List<Member> talent = "ZONE_LEADER".equals(role)
                ? memberRepository.findTalentedButNotServingByZone(zoneId)
                : memberRepository.findTalentedButNotServing();

        return new com.church.cms.dto.dashboard.DashboardKpiDTO(
                totalActive,
                newThisMonth,
                countNew(role, zoneId, LocalDate.now().withDayOfYear(1), LocalDate.now()),
                pendingFollowUps,
                noKcu.size(),
                anomalies.size(),
                talent.size()
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PRIVATE HELPERS
    // ═══════════════════════════════════════════════════════════════════════════

    private long countActive(String role, String zoneId, String kcuId, String status) {
        return switch (role) {
            case "ZONE_LEADER" -> memberRepository.countByStatusAndZone(status, zoneId);
            case "KCU_LEADER"  -> memberRepository.countByStatusAndKcu(status, kcuId);
            default            -> memberRepository.countByMemberStatus(status);
        };
    }

    private long countNew(String role, String zoneId, LocalDate from, LocalDate to) {
        return "ZONE_LEADER".equals(role)
                ? memberRepository.findNewMembersByZone(from, to, zoneId).size()
                : memberRepository.findNewMembers(from, to).size();
    }

    private List<Member> getAllActiveMembers(String role, String zoneId, String kcuId) {
        // Use the filtered query with only the relevant scope applied
        return memberRepository.findFiltered(
                "ZONE_LEADER".equals(role) ? zoneId : null,
                "KCU_LEADER".equals(role)  ? kcuId  : null,
                null, "Active", null,
                org.springframework.data.domain.Pageable.unpaged()
        ).getContent();
    }

    private Map<String, Long> buildGenderDistribution(List<Member> members) {
        return members.stream()
                .filter(m -> m.getGender() != null)
                .collect(Collectors.groupingBy(Member::getGender, Collectors.counting()));
    }

    private Map<String, Long> buildAgeDistribution(List<Member> members) {
        Map<String, Long> dist = new LinkedHashMap<>();
        dist.put("Children",     0L);
        dist.put("Youth",        0L);
        dist.put("Young Adults", 0L);
        dist.put("Adults",       0L);
        dist.put("Seniors",      0L);

        int currentYear = LocalDate.now().getYear();
        for (Member m : members) {
            if (m.getBirthDate() == null) continue;
            int age = currentYear - m.getBirthDate().getYear();
            String bracket = age < 13 ? "Children"
                    : age < 18 ? "Youth"
                    : age < 35 ? "Young Adults"
                    : age < 60 ? "Adults"
                    : "Seniors";
            dist.merge(bracket, 1L, Long::sum);
        }
        return dist;
    }

    private Map<String, Long> buildMaritalDistribution(List<Member> members) {
        return members.stream()
                .filter(m -> m.getMaritalStatus() != null)
                .collect(Collectors.groupingBy(Member::getMaritalStatus, Collectors.counting()));
    }

    private Map<String, Long> buildLocationDistribution(List<Member> members) {
        // Location is stored on the KCU entity
        return members.stream()
                .filter(m -> m.getKcu() != null && m.getKcu().getLocation() != null)
                .collect(Collectors.groupingBy(
                        m -> m.getKcu().getLocation(),
                        Collectors.counting()));
    }

    private MemberSummaryDTO toSummary(Member m) {
        return new MemberSummaryDTO(
                m.getMemberId(), m.getFullName(), m.getPhone(),
                m.getGender(), m.getBirthDate(), m.getMaritalStatus(),
                m.getMemberStatus(), m.getVipStatus(), m.getBaptismStatus(),
                m.getZone() != null ? m.getZone().getZoneName() : null,
                m.getKcu()  != null ? m.getKcu().getKcuName()  : null
        );
    }
}
