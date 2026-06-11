package com.church.cms.service;

import com.church.cms.dto.member.*;
import com.church.cms.entity.*;
import com.church.cms.repository.*;
import com.church.cms.security.SecurityContextHelper;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class MemberService {

    private final MemberRepository memberRepository;
    private final ChildRepository childRepository;
    private final ZoneRepository zoneRepository;
    private final KcuRepository kcuRepository;
    private final MinistryRepository ministryRepository;
    private final CompetencyRepository competencyRepository;
    private final MemberMinistryRepository memberMinistryRepository;
    private final MemberCompetencyRepository memberCompetencyRepository;
    private final SecurityContextHelper securityContextHelper;

    // ── Paginated filtered list ───────────────────────────────────────────────
    public Page<MemberSummaryDTO> getMembers(
            String zoneId, String kcuId, String gender,
            String status, String marital, Pageable pageable) {

        // Apply RBAC data fence using JWT-direct claim extraction (no DB hit)
        String scopedZoneId = resolveZoneScope(zoneId);
        String scopedKcuId  = resolveKcuScope(kcuId);

        return memberRepository
                .findFiltered(scopedZoneId, scopedKcuId, gender, status, marital, pageable)
                .map(this::toSummaryDTO);
    }

    // ── Full profile drilldown ────────────────────────────────────────────────
    public MemberProfileDTO getMemberProfile(String memberId) {
        Member m = memberRepository.findById(memberId)
                .orElseThrow(() -> new RuntimeException("Member not found: " + memberId));

        // KCU_LEADER scope guard — must only access members in their own KCU
        String role = securityContextHelper.getCurrentUserRoleFromJwt();
        if ("KCU_LEADER".equals(role)) {
            String leaderKcuId = securityContextHelper.getCurrentUserKcuIdFromJwt();
            if (m.getKcu() == null || !String.valueOf(m.getKcu().getKcuId()).equals(leaderKcuId)) {
                throw new AccessDeniedException("Access denied: member not in your KCU");
            }
        }

        List<Child> children = childRepository.findByParent_MemberId(memberId);
        List<MemberMinistry> ministries = memberMinistryRepository.findByMember_MemberId(memberId);
        List<MemberCompetency> competencies = memberCompetencyRepository.findByMember_MemberId(memberId);

        return new MemberProfileDTO(
                m.getMemberId(), m.getFullName(), m.getPhone(),
                m.getGender(), m.getBirthDate(), m.getMaritalStatus(),
                m.getMemberStatus(), m.getJoinDate(), m.getNotes(),
                m.getSalvationStatus(), m.getSalvationDate(),
                m.getBaptismStatus(), m.getRightHandGiven(), m.getVipStatus(),
                m.getZone() != null ? m.getZone().getZoneId() : null,
                m.getZone() != null ? m.getZone().getZoneName() : null,
                m.getKcu()  != null ? String.valueOf(m.getKcu().getKcuId()) : null,
                m.getKcu()  != null ? m.getKcu().getKcuName() : null,
                m.getPartner() != null ? m.getPartner().getMemberId() : null,
                m.getPartner() != null ? m.getPartner().getFullName() : null,
                children.stream().map(c -> new ChildDTO(
                        c.getChildId(), c.getChildName(), c.getChildDob(), c.getChildGender()
                )).toList(),
                ministries.stream().map(mm -> mm.getMinistry().getNameEn()).toList(),
                competencies.stream().map(mc -> mc.getCompetency().getSkillName()).toList()
        );
    }

    // ── Transactional registration wizard ────────────────────────────────────
    @Transactional
    public MemberSummaryDTO registerMember(MemberRegistrationRequest req) {
        Member member = new Member();
        member.setMemberId(req.memberId());
        member.setFullName(req.fullName());
        member.setPhone(req.phone());
        member.setGender(req.gender());
        member.setBirthDate(req.birthDate());
        member.setMaritalStatus(req.maritalStatus());
        member.setSalvationStatus(req.salvationStatus() != null ? req.salvationStatus() : 0);
        member.setSalvationDate(req.salvationDate());
        member.setBaptismStatus(req.baptismStatus());
        member.setRightHandGiven(req.rightHandGiven());
        member.setVipStatus(req.vipStatus());
        member.setNotes(req.notes());
        member.setMemberStatus("Active");

        if (req.zoneId() != null) {
            member.setZone(zoneRepository.findById(req.zoneId())
                    .orElseThrow(() -> new RuntimeException("Zone not found: " + req.zoneId())));
        }
        if (req.kcuId() != null) {
            member.setKcu(kcuRepository.findById(Long.parseLong(req.kcuId()))
                    .orElseThrow(() -> new RuntimeException("KCU not found: " + req.kcuId())));
        }
        if (req.partnerId() != null) {
            member.setPartner(memberRepository.findById(req.partnerId())
                    .orElseThrow(() -> new RuntimeException("Partner not found: " + req.partnerId())));
        }

        memberRepository.save(member);

        // Save children
        if (req.children() != null) {
            for (ChildRegistrationRequest cr : req.children()) {
                Child child = new Child();
                child.setChildId(cr.childId() != null ? cr.childId() : UUID.randomUUID().toString());
                child.setParent(member);
                child.setChildName(cr.childName());
                child.setChildDob(cr.childDob());
                child.setChildGender(cr.childGender());
                childRepository.save(child);
            }
        }

        // Save ministry assignments
        if (req.ministryIds() != null) {
            for (String minId : req.ministryIds()) {
                Ministry ministry = ministryRepository.findById(minId)
                        .orElseThrow(() -> new RuntimeException("Ministry not found: " + minId));
                MemberMinistry mm = new MemberMinistry();
                mm.setMember(member);
                mm.setMinistry(ministry);
                memberMinistryRepository.save(mm);
            }
        }

        // Save competency assignments
        if (req.competencyIds() != null) {
            for (String compId : req.competencyIds()) {
                Competency competency = competencyRepository.findById(compId)
                        .orElseThrow(() -> new RuntimeException("Competency not found: " + compId));
                MemberCompetency mc = new MemberCompetency();
                mc.setMember(member);
                mc.setCompetency(competency);
                memberCompetencyRepository.save(mc);
            }
        }

        return toSummaryDTO(member);
    }

    // ── Profile update (intercepted by MemberAuditAspect for audit trail) ────
    @Transactional
    public MemberSummaryDTO updateMember(String memberId, MemberRegistrationRequest req) {
        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new RuntimeException("Member not found: " + memberId));

        // Apply null-safe field updates
        if (req.fullName()        != null) member.setFullName(req.fullName());
        if (req.phone()           != null) member.setPhone(req.phone());
        if (req.gender()          != null) member.setGender(req.gender());
        if (req.birthDate()       != null) member.setBirthDate(req.birthDate());
        if (req.maritalStatus()   != null) member.setMaritalStatus(req.maritalStatus());
        if (req.salvationStatus() != null) member.setSalvationStatus(req.salvationStatus());
        if (req.salvationDate()   != null) member.setSalvationDate(req.salvationDate());
        if (req.baptismStatus()   != null) member.setBaptismStatus(req.baptismStatus());
        if (req.rightHandGiven()  != null) member.setRightHandGiven(req.rightHandGiven());
        if (req.vipStatus()       != null) member.setVipStatus(req.vipStatus());
        if (req.notes()           != null) member.setNotes(req.notes());

        if (req.zoneId() != null) {
            member.setZone(zoneRepository.findById(req.zoneId())
                    .orElseThrow(() -> new RuntimeException("Zone not found: " + req.zoneId())));
        }
        if (req.kcuId() != null) {
            member.setKcu(kcuRepository.findById(Long.parseLong(req.kcuId()))
                    .orElseThrow(() -> new RuntimeException("KCU not found: " + req.kcuId())));
        }

        memberRepository.save(member);
        return toSummaryDTO(member);
    }

    // ── RBAC scope resolvers (JWT-direct — no DB roundtrip) ──────────────────
    private String resolveZoneScope(String requestedZoneId) {
        String role = securityContextHelper.getCurrentUserRoleFromJwt();
        if ("ZONE_LEADER".equals(role)) {
            String zoneId = securityContextHelper.getCurrentUserZoneIdFromJwt();
            return zoneId.isEmpty() ? null : zoneId;
        }
        if ("KCU_LEADER".equals(role)) {
            return null; // KCU scope takes precedence; zone filter not needed
        }
        return requestedZoneId; // ADMIN/PASTOR: use whatever was requested
    }

    private String resolveKcuScope(String requestedKcuId) {
        String role = securityContextHelper.getCurrentUserRoleFromJwt();
        if ("KCU_LEADER".equals(role)) {
            String kcuId = securityContextHelper.getCurrentUserKcuIdFromJwt();
            return kcuId.isEmpty() ? null : kcuId;
        }
        return requestedKcuId;
    }

    // ── Mapper ────────────────────────────────────────────────────────────────
    public MemberSummaryDTO toSummaryDTO(Member m) {
        return new MemberSummaryDTO(
                m.getMemberId(), m.getFullName(), m.getPhone(),
                m.getGender(), m.getBirthDate(), m.getMaritalStatus(),
                m.getMemberStatus(), m.getVipStatus(), m.getBaptismStatus(),
                m.getZone() != null ? m.getZone().getZoneName() : null,
                m.getKcu()  != null ? m.getKcu().getKcuName()  : null
        );
    }
}
