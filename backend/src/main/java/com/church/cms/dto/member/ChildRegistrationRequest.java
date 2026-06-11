package com.church.cms.dto.member;

import java.time.LocalDate;

public record ChildRegistrationRequest(
        String childId,
        String childName,
        LocalDate childDob,
        String childGender
) {}
