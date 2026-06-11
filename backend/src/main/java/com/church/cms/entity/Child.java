package com.church.cms.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDate;

@Entity
@Table(name = "children")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Child {

    @Id
    @Column(name = "child_id", length = 50)
    private String childId;

    @ManyToOne
    @JoinColumn(name = "parent_id")
    private Member parent;

    @Column(name = "child_name", length = 100)
    private String childName;

    @Column(name = "child_dob")
    private LocalDate childDob;

    @Column(name = "child_gender", length = 10)
    private String childGender;
}