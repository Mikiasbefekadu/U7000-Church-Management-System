package com.church.cms.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDate;

@Entity
@Table(name = "members")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Member {

    @Id
    @Column(name = "member_id", length = 50)
    private String memberId;

    @Column(name = "full_name", nullable = false, length = 200)
    private String fullName;

    @Column(name = "phone", unique = true, nullable = false, length = 20)
    private String phone;

    private String gender;

    @Column(name = "birth_date")
    private LocalDate birthDate;

    private String maritalStatus;

    // Self-reference for spouses — suppress partner's own partner to avoid cycle
    @ManyToOne
    @JoinColumn(name = "partner_member_id")
    @JsonIgnoreProperties("partner")
    private Member partner;

    // Spiritual Milestones
    private Integer salvationStatus = 0;
    private LocalDate salvationDate;
    private String baptismStatus;
    private String rightHandGiven;
    private String vipStatus;

    // Hierarchy links — suppress back-references to avoid Zone→Kcu→Zone cycle
    @ManyToOne
    @JoinColumn(name = "zone_id")
    @JsonIgnoreProperties("kcus")
    private Zone zone;

    @ManyToOne
    @JoinColumn(name = "kcu_id")
    @JsonIgnoreProperties("zone")
    private Kcu kcu;

    @Column(name = "member_status", length = 20)
    private String memberStatus = "Active";

    private LocalDate joinDate = LocalDate.now();

    @Column(columnDefinition = "TEXT")
    private String notes;
}
