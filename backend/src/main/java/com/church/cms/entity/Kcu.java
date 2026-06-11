package com.church.cms.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "kcus")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Kcu {

    /**
     * Auto-incremented numeric PK — PostgreSQL BIGSERIAL / IDENTITY.
     * The spreadsheet's string codes (e.g. "K001") are intentionally ignored
     * during seeding so the database assigns its own IDs.
     */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "kcu_id")
    private Long kcuId;

    // Suppress the back-reference list on Zone to break the Zone→Kcu→Zone cycle
    @ManyToOne
    @JoinColumn(name = "zone_id")
    @JsonIgnoreProperties("kcus")
    private Zone zone;

    @Column(name = "kcu_name", nullable = false, length = 100)
    private String kcuName;

    /** 'GENERAL' or 'YOUNG_ADULT' */
    @Column(name = "kcu_type", length = 20)
    private String kcuType = "GENERAL";

    @Column(name = "kcu_leader", length = 100)
    private String kcuLeader;

    @Column(name = "assistant", length = 100)
    private String assistant;

    @Column(name = "leader_phone", length = 20)
    private String leaderPhone;

    @Column(name = "assistant_phone", length = 20)
    private String assistantPhone;

    @Column(name = "meeting_day", length = 20)
    private String meetingDay;

    @Column(name = "meeting_time", length = 20)
    private String meetingTime;

    @Column(name = "location", length = 200)
    private String location;
}
