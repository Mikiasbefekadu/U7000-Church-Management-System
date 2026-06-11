package com.church.cms.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDate;

@Entity
@Table(name = "attendance")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Attendance {

    @Id
    @Column(name = "att_id", length = 50)
    private String attId;

    @ManyToOne
    @JoinColumn(name = "member_id")
    private Member member;

    @Column(name = "event_type", nullable = false, length = 50)
    private String eventType; // KCU, SUNDAY, WEDNESDAY, SPECIAL

    @Column(name = "att_date", nullable = false)
    private LocalDate attDate;

    @Column(nullable = false, length = 20)
    private String status; // PRESENT, ABSENT
}