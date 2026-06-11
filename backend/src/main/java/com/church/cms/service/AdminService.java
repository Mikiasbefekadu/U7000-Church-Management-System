package com.church.cms.service;

import com.church.cms.entity.*;
import com.church.cms.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class AdminService {

    private final ZoneRepository zoneRepository;
    private final KcuRepository kcuRepository;
    private final MinistryRepository ministryRepository;
    private final CompetencyRepository competencyRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    // ── Zone management ───────────────────────────────────────────────────────
    public List<Zone> getAllZones() { return zoneRepository.findAll(); }

    @Transactional
    public Zone saveZone(Zone zone) { return zoneRepository.save(zone); }

    @Transactional
    public void deleteZone(String zoneId) { zoneRepository.deleteById(zoneId); }

    // ── KCU management ────────────────────────────────────────────────────────
    public List<Kcu> getAllKcus() { return kcuRepository.findAll(); }

    public List<Kcu> getKcusByZone(String zoneId) { return kcuRepository.findByZone_ZoneId(zoneId); }

    @Transactional
    public Kcu saveKcu(Kcu kcu) { return kcuRepository.save(kcu); }

    @Transactional
    public void deleteKcu(Long kcuId) { kcuRepository.deleteById(kcuId); }

    // ── Ministry lookup management ────────────────────────────────────────────
    public List<Ministry> getAllMinistries() { return ministryRepository.findAll(); }

    @Transactional
    public Ministry saveMinistry(Ministry ministry) { return ministryRepository.save(ministry); }

    // ── Competency lookup management ──────────────────────────────────────────
    public List<Competency> getAllCompetencies() { return competencyRepository.findAll(); }

    @Transactional
    public Competency saveCompetency(Competency competency) { return competencyRepository.save(competency); }

    // ── User account management ───────────────────────────────────────────────
    public List<User> getAllUsers() { return userRepository.findAll(); }

    @Transactional
    public User createUser(User user) {
        user.setPassword(passwordEncoder.encode(user.getPassword()));
        return userRepository.save(user);
    }

    @Transactional
    public void resetPassword(String userId, String newPassword) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found: " + userId));
        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);
    }
}
