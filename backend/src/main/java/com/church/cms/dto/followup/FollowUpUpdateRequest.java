package com.church.cms.dto.followup;

import jakarta.validation.constraints.NotBlank;

public record FollowUpUpdateRequest(
        @NotBlank String status,  // PENDING or RESOLVED
        String notes
) {}
