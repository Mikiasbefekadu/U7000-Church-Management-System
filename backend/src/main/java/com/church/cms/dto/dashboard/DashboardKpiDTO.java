package com.church.cms.dto.dashboard;

/**
 * Top-level KPI block for the unified dashboard.
 * All counts are pre-scoped by the user's RBAC data fence.
 */
public record DashboardKpiDTO(
        long totalActiveMembers,
        long newMembersThisMonth,
        long newMembersThisYear,
        long pendingFollowUps,
        long membersWithNoKcu,
        long leadershipAnomalies,
        long talentNotServing
) {}
