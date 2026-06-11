package com.church.cms.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class User {

    @Id
    @Column(name = "user_id", length = 50)
    private String userId;

    @Column(unique = true, nullable = false, length = 100)
    private String username;

    @Column(name = "password_hash", nullable = false)
    private String password;

    @Column(nullable = false, length = 20)
    private String role; // ADMIN, PASTOR, ZONE_LEADER, KCU_LEADER

    // Link this user account to their actual member profile.
    // Suppress deep member graph (zone, kcu, partner, children) to avoid cycles.
    @OneToOne
    @JoinColumn(name = "member_id")
    @JsonIgnoreProperties({"zone", "kcu", "partner", "password"})
    private Member member;

    // Scope restriction fields — suppress their own back-references to avoid cycles.
    @ManyToOne
    @JoinColumn(name = "assigned_zone_id")
    @JsonIgnoreProperties("kcus")
    private Zone assignedZone;

    @ManyToOne
    @JoinColumn(name = "assigned_kcu_id")
    @JsonIgnoreProperties("zone")
    private Kcu assignedKcu;
}
