package com.church.cms.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "ministries")
@Getter @Setter
@NoArgsConstructor
@AllArgsConstructor
public class Ministry {

    @Id
    @Column(name = "min_id", length = 50)
    private String minId;

    @Column(name = "name_am", length = 100) // Amharic Name
    private String nameAm;

    @Column(name = "name_en", length = 100) // English Name
    private String nameEn;
}