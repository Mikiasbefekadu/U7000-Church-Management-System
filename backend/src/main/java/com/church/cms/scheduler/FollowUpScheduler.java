package com.church.cms.scheduler;

import com.church.cms.entity.FollowUp;
import com.church.cms.entity.Member;
import com.church.cms.repository.AttendanceRepository;
import com.church.cms.repository.FollowUpRepository;
import com.church.cms.repository.MemberRepository;
import com.church.cms.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Weekly pastoral care scheduler.
 *
 * Fires every Sunday at 23:00 and auto-generates FollowUp records for any
 * member who has missed 2 or more KCU sessions in the trailing 21-day window.
 *
 * Deduplication: if a PENDING follow-up already exists for a member, no
 * additional record is created.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class FollowUpScheduler {

    private final AttendanceRepository attendanceRepository;
    private final MemberRepository memberRepository;
    private final FollowUpRepository followUpRepository;
    private final UserRepository userRepository;

    @Scheduled(cron = "0 0 23 * * SUN")
    @Transactional
    public void triggerWeeklyFollowUpGeneration() {
        LocalDate since = LocalDate.now().minusDays(21);
        List<String> memberIds = attendanceRepository.findMembersWithConsecutiveKcuAbsences(since);

        log.info("[FollowUpScheduler] Running weekly check. Window: {} → today. Qualifying members: {}",
                since, memberIds.size());

        int created = 0;
        for (String memberId : memberIds) {
            // Skip if a PENDING follow-up already exists — avoid duplicates
            if (followUpRepository.existsByMember_MemberIdAndStatus(memberId, "PENDING")) {
                log.debug("[FollowUpScheduler] Skipping {} — PENDING follow-up already exists", memberId);
                continue;
            }

            Member member = memberRepository.findById(memberId).orElse(null);
            if (member == null) continue;

            FollowUp followUp = new FollowUp();
            followUp.setFollowupId(UUID.randomUUID().toString());
            followUp.setMember(member);
            followUp.setReason("Missed 2+ KCU Sessions (3-week window)");
            followUp.setStatus("PENDING");
            followUp.setCreatedAt(LocalDateTime.now());

            // Assign to the KCU leader's user account if one exists
            if (member.getKcu() != null) {
                userRepository.findAll().stream()
                        .filter(u -> u.getAssignedKcu() != null
                                && u.getAssignedKcu().getKcuId().equals(member.getKcu().getKcuId()))
                        .findFirst()
                        .ifPresent(followUp::setAssignedTo);
            }

            followUpRepository.save(followUp);
            created++;
            log.info("[FollowUpScheduler] Created follow-up for member {} ({})",
                    memberId, member.getFullName());
        }

        log.info("[FollowUpScheduler] Done. {} follow-up(s) created.", created);
    }
}
