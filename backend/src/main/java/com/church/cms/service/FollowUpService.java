package com.church.cms.service;

import com.church.cms.dto.followup.FollowUpDTO;
import com.church.cms.dto.followup.FollowUpUpdateRequest;
import com.church.cms.entity.FollowUp;
import com.church.cms.entity.User;
import com.church.cms.repository.FollowUpRepository;
import com.church.cms.security.SecurityContextHelper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class FollowUpService {

    private final FollowUpRepository followUpRepository;
    private final SecurityContextHelper securityContextHelper;

    // ── Worklist scoped by role ───────────────────────────────────────────────
    public List<FollowUpDTO> getPendingFollowUps() {
        User currentUser = securityContextHelper.getCurrentUser();
        String role = currentUser.getRole();

        List<FollowUp> results = switch (role) {
            case "KCU_LEADER" ->
                followUpRepository.findByAssignedTo_UserIdAndStatus(currentUser.getUserId(), "PENDING");
            case "ZONE_LEADER" ->
                followUpRepository.findByZoneAndStatus(
                        currentUser.getAssignedZone().getZoneId(), "PENDING");
            default ->
                followUpRepository.findByStatus("PENDING");
        };

        return results.stream().map(this::toDTO).toList();
    }

    // ── Leader response diagnostic: not contacted in 72 hours ────────────────
    public List<FollowUpDTO> getOverdueFollowUps() {
        LocalDateTime cutoff = LocalDateTime.now().minusHours(72);
        return followUpRepository.findPendingOlderThan(cutoff)
                .stream().map(this::toDTO).toList();
    }

    // ── Update status from worklist ───────────────────────────────────────────
    @Transactional
    public FollowUpDTO updateFollowUp(String followupId, FollowUpUpdateRequest req) {
        FollowUp followUp = followUpRepository.findById(followupId)
                .orElseThrow(() -> new RuntimeException("FollowUp not found: " + followupId));
        followUp.setStatus(req.status());
        if (req.notes() != null) {
            followUp.setNotes(req.notes());
        }
        return toDTO(followUpRepository.save(followUp));
    }

    // ── Mapper ────────────────────────────────────────────────────────────────
    private FollowUpDTO toDTO(FollowUp f) {
        return new FollowUpDTO(
                f.getFollowupId(),
                f.getMember().getMemberId(),
                f.getMember().getFullName(),
                f.getMember().getPhone(),
                f.getMember().getKcu() != null ? f.getMember().getKcu().getKcuName() : null,
                f.getReason(),
                f.getStatus(),
                f.getAssignedTo() != null ? f.getAssignedTo().getUserId() : null,
                f.getAssignedTo() != null ? f.getAssignedTo().getUsername() : null,
                f.getNotes(),
                f.getCreatedAt()
        );
    }
}
