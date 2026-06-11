package com.church.cms.repository;

import com.church.cms.entity.Kcu;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface KcuRepository extends JpaRepository<Kcu, Long> {

    List<Kcu> findByZone_ZoneId(String zoneId);
}
