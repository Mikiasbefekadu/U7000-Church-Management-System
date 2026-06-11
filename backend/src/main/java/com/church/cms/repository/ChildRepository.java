package com.church.cms.repository;

import com.church.cms.entity.Child;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ChildRepository extends JpaRepository<Child, String> {

    List<Child> findByParent_MemberId(String parentId);
}
