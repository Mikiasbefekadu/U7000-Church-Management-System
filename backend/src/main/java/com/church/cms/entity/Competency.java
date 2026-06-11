package com.church.cms.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "competencies")
@Getter @Setter
@NoArgsConstructor
@AllArgsConstructor
public class Competency {

    @Id
    @Column(name = "comp_id", length = 50)
    private String compId;

    @Column(name = "skill_name", length = 100)
    private String skillName;
}