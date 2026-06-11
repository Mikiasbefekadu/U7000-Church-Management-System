package com.church.cms.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.*;
import java.util.List;

@Entity
@Table(name = "zones")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Zone {

    @Id
    @Column(name = "zone_id", length = 50)
    private String zoneId;

    @Column(name = "zone_name", nullable = false, length = 100)
    private String zoneName;

    @Column(name = "phone", length = 20)
    private String phone;

    @Column(name = "zone_leader", length = 100)
    private String zoneLeader;

    // One zone can have many KCUs — suppress back-reference to avoid infinite recursion
    @OneToMany(mappedBy = "zone")
    @JsonIgnoreProperties("zone")
    private List<Kcu> kcus;
}