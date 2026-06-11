package com.church.cms.entity;

import jakarta.persistence.*;
import lombok.*;
import java.io.Serializable;

@Entity
@Table(name = "member_ministries")
@Getter @Setter
@NoArgsConstructor
@AllArgsConstructor
public class MemberMinistry {

    @EmbeddedId
    private MemberMinistryId id;

    @ManyToOne
    @MapsId("memberId")
    @JoinColumn(name = "member_id")
    private Member member;

    @ManyToOne
    @MapsId("ministryId")
    @JoinColumn(name = "ministry_id")
    private Ministry ministry;

    private Integer priority; // 1, 2, or 3
}

@Embeddable
@Data
class MemberMinistryId implements Serializable {
    private String memberId;
    private String ministryId;
}