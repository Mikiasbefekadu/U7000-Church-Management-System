package com.church.cms.dto.member;

import java.time.LocalDate;
import java.util.List;

/**
 * Full profile payload for the Member Profile drilldown page.
 */
public record MemberProfileDTO(
        String memberId,
        String fullName,
        String phone,
        String gender,
        LocalDate birthDate,
        String maritalStatus,
        String memberStatus,
        LocalDate joinDate,
        String notes,

        // Spiritual milestones
        Integer salvationStatus,
        LocalDate salvationDate,
        String baptismStatus,
        String rightHandGiven,
        String vipStatus,

        // Hierarchy
        String zoneId,
        String zoneName,
        String kcuId,
        String kcuName,

        // Family
        String partnerId,
        String partnerName,
        List<ChildDTO> children,

        // Ministries and skills
        List<String> ministries,
        List<String> competencies
) {}
