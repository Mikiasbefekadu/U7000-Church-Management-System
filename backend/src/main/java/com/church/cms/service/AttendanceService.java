package com.church.cms.service;

import com.church.cms.dto.attendance.AttendanceSubmissionDTO;
import com.church.cms.entity.Attendance;
import com.church.cms.entity.Member;
import com.church.cms.repository.AttendanceRepository;
import com.church.cms.repository.FollowUpRepository;
import com.church.cms.repository.MemberRepository;
import com.church.cms.repository.UserRepository;
import com.church.cms.security.SecurityContextHelper;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AttendanceService {

    private final AttendanceRepository attendanceRepository;
    private final MemberRepository memberRepository;
    private final FollowUpRepository followUpRepository;
    private final UserRepository userRepository;
    private final SecurityContextHelper securityContextHelper;

    /**
     * Bulk attendance submission with KCU scope enforcement.
     *
     * If the caller is a KCU_LEADER, every member in the batch must belong to
     * their assigned KCU. A single out-of-scope member rejects the entire batch
     * atomically (the method is @Transactional).
     *
     * After saving, the Care Engine runs automatically: any member with 2+
     * ABSENT records since 2 weeks ago gets a PENDING FollowUp assigned to
     * their KCU leader's user account.
     */
    @Transactional
    public void submitBulkAttendance(List<AttendanceSubmissionDTO> submissions) {
        // ── KCU scope guard ───────────────────────────────────────────────────
        String role = securityContextHelper.getCurrentUserRoleFromJwt();
        String leaderKcuId = null;
        if ("KCU_LEADER".equals(role)) {
            String raw = securityContextHelper.getCurrentUserKcuIdFromJwt();
            leaderKcuId = raw.isEmpty() ? null : raw;
        }

        for (AttendanceSubmissionDTO dto : submissions) {
            Member member = memberRepository.findById(dto.memberId())
                    .orElseThrow(() -> new RuntimeException("Member not found: " + dto.memberId()));

            // Enforce KCU boundary — reject entire batch if any member is out of scope
            if (leaderKcuId != null) {
                if (member.getKcu() == null
                        || !member.getKcu().getKcuId().equals(leaderKcuId)) {
                    throw new AccessDeniedException(
                            "Access denied: member " + dto.memberId() + " is not in your KCU");
                }
            }

            Attendance att = new Attendance();
            att.setAttId(UUID.randomUUID().toString());
            att.setMember(member);
            att.setEventType(dto.eventType());
            att.setAttDate(dto.attDate());
            att.setStatus(dto.status());
            attendanceRepository.save(att);
        }

        // ── Care Engine: auto-generate follow-ups ─────────────────────────────
        triggerCareEngine();
    }

    private void triggerCareEngine() {
        LocalDate twoWeeksAgo = LocalDate.now().minusWeeks(2);
        List<String> absentMemberIds = attendanceRepository.findMemberIdsAbsentTwoPlusWeeks(twoWeeksAgo);

        for (String memberId : absentMemberIds) {
            // Avoid duplicate pending follow-ups
            if (followUpRepository.existsByMember_MemberIdAndStatus(memberId, "PENDING")) {
                continue;
            }

            Member member = memberRepository.findById(memberId).orElse(null);
            if (member == null) continue;

            com.church.cms.entity.FollowUp followUp = new com.church.cms.entity.FollowUp();
            followUp.setFollowupId(UUID.randomUUID().toString());
            followUp.setMember(member);
            followUp.setReason("Absent 2+ Weeks");
            followUp.setStatus("PENDING");

            // Assign to the KCU leader's user account if resolvable
            if (member.getKcu() != null) {
                userRepository.findAll().stream()
                        .filter(u -> u.getAssignedKcu() != null
                                && u.getAssignedKcu().getKcuId().equals(member.getKcu().getKcuId()))
                        .findFirst()
                        .ifPresent(followUp::setAssignedTo);
            }

            followUpRepository.save(followUp);
        }
    }
}
