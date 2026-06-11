package com.church.cms.repository;

import com.church.cms.entity.MemberMinistry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MemberMinistryRepository extends JpaRepository<MemberMinistry, Object> {

    List<MemberMinistry> findByMember_MemberId(String memberId);

    // Ministry density: count of active members per ministry
    @Query("""
            SELECT mm.ministry.minId, mm.ministry.nameEn, COUNT(mm)
            FROM MemberMinistry mm
            WHERE mm.member.memberStatus = 'Active'
            GROUP BY mm.ministry.minId, mm.ministry.nameEn
            ORDER BY COUNT(mm) DESC
            """)
    List<Object[]> findMinistryDensities();

    @Query("""
            SELECT mm.ministry.minId, mm.ministry.nameEn, COUNT(mm)
            FROM MemberMinistry mm
            WHERE mm.member.memberStatus = 'Active'
              AND mm.member.zone.zoneId = :zoneId
            GROUP BY mm.ministry.minId, mm.ministry.nameEn
            ORDER BY COUNT(mm) DESC
            """)
    List<Object[]> findMinistryDensitiesByZone(@Param("zoneId") String zoneId);
}
