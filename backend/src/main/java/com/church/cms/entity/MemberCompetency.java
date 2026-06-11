package com.church.cms.entity;

import jakarta.persistence.*;
import lombok.*;
import java.io.Serializable;

@Entity
@Table(name = "member_competencies")
@Getter @Setter
@NoArgsConstructor
@AllArgsConstructor
public class MemberCompetency {

    @EmbeddedId
    private MemberCompetencyId id;

    @ManyToOne
    @MapsId("memberId")
    @JoinColumn(name = "member_id")
    private Member member;

    @ManyToOne
    @MapsId("competencyId")
    @JoinColumn(name = "competency_id")
    private Competency competency;
}

@Embeddable
@Data
class MemberCompetencyId implements Serializable {
    private String memberId;
    private String competencyId;
}