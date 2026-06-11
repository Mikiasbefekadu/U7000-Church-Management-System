package com.church.cms.repository;

import com.church.cms.entity.MemberCompetency;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MemberCompetencyRepository extends JpaRepository<MemberCompetency, Object> {

    List<MemberCompetency> findByMember_MemberId(String memberId);
}
