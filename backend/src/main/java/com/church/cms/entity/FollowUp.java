package com.church.cms.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "follow_ups")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class FollowUp {

    @Id
    @Column(name = "followup_id", length = 50)
    private String followupId;

    @ManyToOne
    @JoinColumn(name = "member_id")
    private Member member;

    @Column(length = 100)
    private String reason; // e.g., 'Absent 2+ Weeks'

    @Column(length = 20)
    private String status; // PENDING, RESOLVED

    @ManyToOne
    @JoinColumn(name = "assigned_to_user_id")
    private User assignedTo;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();
}