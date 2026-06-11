package com.church.cms.dto.followup;

import java.time.LocalDateTime;

public record FollowUpDTO(
        String followupId,
        String memberId,
        String memberName,
        String memberPhone,
        String kcuName,
        String reason,
        String status,
        String assignedToUserId,
        String assignedToName,
        String notes,
        LocalDateTime createdAt
) {}
