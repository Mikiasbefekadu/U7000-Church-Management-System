# Implementation Plan: CMS Backend Alignment

## Overview

Four targeted changes to align the CMS Spring Boot 4.x backend with the SDS/SRS specification. Tasks are ordered by dependency: Flyway first (foundational schema), then KCU scoping (security layer), then the scheduler (depends on repositories), then the AOP audit trail (depends on MemberService.updateMember). Each task is independently implementable within its group.

## Tasks

- [x] 1. Add Maven dependencies for Flyway and AOP
  - In `pom.xml`, add `org.flywaydb:flyway-core` (no version — managed by Spring Boot BOM)
  - In `pom.xml`, add `org.flywaydb:flyway-database-postgresql` (no version — required for Flyway 10.x + PostgreSQL)
  - In `pom.xml`, add `spring-boot-starter-aop` (no version — managed by Spring Boot BOM)
  - _Requirements: 1.1, 4.1_

- [ ] 2. Create Flyway migration scripts
  - [x] 2.1 Create `src/main/resources/db/migration/V1__init.sql`
    - Copy the full DDL content from `src/main/resources/schema.sql` verbatim (all `CREATE EXTENSION`, `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, and the deferred FK `DO $$ ... $$` block)
    - Append the `audit_log` schema and `audit_log.member_audit` table DDL at the end of the file (see design.md Change 1 section for exact SQL)
    - _Requirements: 1.3_

  - [ ] 2.2 Create `src/main/resources/db/migration/V2__seed.sql`
    - Copy the full content of `src/main/resources/import.sql` verbatim — all inserts already use `ON CONFLICT DO NOTHING`
    - Retain the `UPDATE members SET partner_member_id = 'M012' ...` statement
    - _Requirements: 1.4_

  - [~] 2.3 Delete `src/main/resources/schema.sql` and `src/main/resources/import.sql`
    - Remove both files from the project
    - _Requirements: 1.7_

- [~] 3. Update application.properties for Flyway
  - Replace `spring.jpa.hibernate.ddl-auto=update` with `spring.jpa.hibernate.ddl-auto=validate`
  - Remove the `spring.sql.init.mode=never` line entirely
  - Add `spring.flyway.enabled=true`
  - Add `spring.flyway.locations=classpath:db/migration`
  - _Requirements: 1.5, 1.6_

- [~] 4. Checkpoint — Verify Flyway startup
  - Start the application against a clean or existing `church_db` database and confirm it starts without errors
  - Verify `flyway_schema_history` table exists and contains rows for V1 and V2
  - Verify `audit_log.member_audit` table exists
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Upgrade JwtUtil with KCU and role claim extractors
  - Add `extractKcuId(String token)` method: `return extractClaim(token, claims -> claims.get("kcuId", String.class));`
  - Add `extractRole(String token)` method: `return extractClaim(token, claims -> claims.get("role", String.class));`
  - Both methods reuse the existing `extractClaim` generic helper — no new parsing logic needed
  - _Requirements: 2.1, 2.2_

  - [ ]* 5.1 Write property test for JWT claim round-trip extraction
    - **Property 1: JWT claim round-trip extraction**
    - Generate random `kcuId` strings and `role` strings, build a JWT via `JwtUtil.generateToken` with those as extra claims, then assert `extractKcuId` and `extractRole` return the exact values
    - **Validates: Requirements 2.1, 2.2**

- [~] 6. Upgrade JwtAuthFilter to store raw JWT in Authentication details
  - In `JwtAuthFilter.doFilterInternal`, replace:
    `authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));`
    with:
    `authToken.setDetails(jwt);`
  - The `jwt` variable is already in scope (extracted from the Authorization header)
  - _Requirements: 2.3_

- [~] 7. Upgrade SecurityContextHelper with JWT-direct methods
  - Add `JwtUtil` as a constructor-injected dependency (Lombok `@RequiredArgsConstructor` handles this automatically once the field is declared)
  - Add private helper `getRawJwt()`: get `Authentication` from `SecurityContextHolder`, cast `auth.getDetails()` to `String`, throw `RuntimeException` if not a String
  - Add `getCurrentUserKcuIdFromJwt()`: delegates to `jwtUtil.extractKcuId(getRawJwt())`
  - Add `getCurrentUserRoleFromJwt()`: delegates to `jwtUtil.extractRole(getRawJwt())`
  - Add `getCurrentUserZoneIdFromJwt()`: delegates to `jwtUtil.extractClaim(getRawJwt(), claims -> claims.get("zoneId", String.class))`
  - Keep existing `getCurrentUser()`, `getCurrentUserRole()`, `getCurrentUserZoneId()`, `getCurrentUserKcuId()` methods intact (used by AOP aspect for `changedBy`)
  - _Requirements: 2.4_

- [ ] 8. Add KCU scope guard to MemberService.getMemberProfile
  - After loading the `Member` entity and before building the `MemberProfileDTO`, add the scope check:
    - Call `securityContextHelper.getCurrentUserRoleFromJwt()` to get the role
    - If role is `"KCU_LEADER"`, call `securityContextHelper.getCurrentUserKcuIdFromJwt()` to get `leaderKcuId`
    - If `member.getKcu() == null` or `!member.getKcu().getKcuId().equals(leaderKcuId)`, throw `new AccessDeniedException("Access denied: member not in your KCU")`
  - Add import: `org.springframework.security.access.AccessDeniedException`
  - _Requirements: 2.5, 2.6_

  - [ ]* 8.1 Write property test for KCU scope isolation on getMemberProfile
    - **Property 2: KCU scope isolation for member profile**
    - Mock `SecurityContextHelper` to return role `KCU_LEADER` and a random `kcuId`; mock `MemberRepository` to return a member with a different `kcuId`; assert `AccessDeniedException` is thrown
    - Also assert that when the member's `kcuId` matches the leader's, no exception is thrown
    - **Validates: Requirements 2.5, 2.6**

- [~] 9. Update MemberService scope resolvers to use JWT-direct methods
  - In `resolveZoneScope`: replace `securityContextHelper.getCurrentUserRole()` with `securityContextHelper.getCurrentUserRoleFromJwt()` and replace `securityContextHelper.getCurrentUserZoneId()` with `securityContextHelper.getCurrentUserZoneIdFromJwt()`
  - In `resolveKcuScope`: replace `securityContextHelper.getCurrentUserRole()` with `securityContextHelper.getCurrentUserRoleFromJwt()` and replace `securityContextHelper.getCurrentUserKcuId()` with `securityContextHelper.getCurrentUserKcuIdFromJwt()`
  - _Requirements: 2.10_

- [ ] 10. Add KCU scope guard to AttendanceService.submitBulkAttendance
  - At the start of `submitBulkAttendance`, before the save loop:
    - Call `securityContextHelper.getCurrentUserRoleFromJwt()` to get the role
    - If role is `"KCU_LEADER"`, store `leaderKcuId = securityContextHelper.getCurrentUserKcuIdFromJwt()`; otherwise `leaderKcuId = null`
  - Inside the loop, after loading the `Member`, if `leaderKcuId != null`:
    - If `member.getKcu() == null` or `!member.getKcu().getKcuId().equals(leaderKcuId)`, throw `new AccessDeniedException("Access denied: member " + dto.memberId() + " is not in your KCU")`
  - The method is already `@Transactional` so the entire batch rolls back on exception
  - _Requirements: 2.7, 2.8, 2.9_

  - [ ]* 10.1 Write property test for KCU scope isolation on submitBulkAttendance
    - **Property 3: KCU scope isolation for attendance submission — atomicity**
    - Mock `SecurityContextHelper` to return role `KCU_LEADER` and `kcuId = "KCU001"`; create a batch where at least one member has `kcuId = "KCU002"`; assert `AccessDeniedException` is thrown and `AttendanceRepository.save` is never called
    - **Validates: Requirements 2.7, 2.8**

  - [ ]* 10.2 Write property test for ADMIN/PASTOR bypass
    - **Property 4: ADMIN/PASTOR bypass of KCU scope restriction**
    - Mock `SecurityContextHelper` to return role `ADMIN`; assert that `getMemberProfile` and `submitBulkAttendance` succeed for members with any `kcuId`
    - **Validates: Requirements 2.9**

- [~] 11. Checkpoint — Verify KCU scoping end-to-end
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 12. Add findMembersWithConsecutiveKcuAbsences query to AttendanceRepository
  - Add the following JPQL query method to `AttendanceRepository`:
    ```java
    @Query("""
        SELECT a.member.memberId
        FROM Attendance a
        WHERE a.status = 'ABSENT'
          AND a.eventType = 'KCU'
          AND a.attDate >= :since
        GROUP BY a.member.memberId
        HAVING COUNT(a) >= 2
        """)
    List<String> findMembersWithConsecutiveKcuAbsences(@Param("since") LocalDate since);
    ```
  - _Requirements: 3.4_

  - [ ]* 12.1 Write property test for KCU absence query correctness
    - **Property 5: KCU absence query correctness**
    - Use `@DataJpaTest` with an in-memory or test PostgreSQL; insert attendance records with varying event types, statuses, and dates; assert the query returns exactly the members with 2+ ABSENT KCU records in the window and excludes members with only SUNDAY/WEDNESDAY absences
    - **Validates: Requirements 3.3, 3.4, 3.9**

- [~] 13. Enable scheduling on CmsApplication
  - Add `@EnableScheduling` annotation to `CmsApplication` class
  - Import: `org.springframework.scheduling.annotation.EnableScheduling`
  - _Requirements: 3.1_

- [ ] 14. Create FollowUpScheduler component
  - Create new file `src/main/java/com/church/cms/scheduler/FollowUpScheduler.java`
  - Annotate with `@Component` and `@RequiredArgsConstructor`
  - Inject: `AttendanceRepository`, `MemberRepository`, `FollowUpRepository`, `UserRepository`
  - Implement `triggerWeeklyFollowUpGeneration()` annotated with `@Scheduled(cron = "0 0 23 * * SUN")` and `@Transactional`:
    - Compute `since = LocalDate.now().minusDays(21)`
    - Call `attendanceRepository.findMembersWithConsecutiveKcuAbsences(since)`
    - For each `memberId`: skip if `followUpRepository.existsByMember_MemberIdAndStatus(memberId, "PENDING")` is true
    - Load member via `memberRepository.findById(memberId).orElse(null)`; skip if null
    - Build `FollowUp` with `followupId = UUID.randomUUID().toString()`, `reason = "Missed 2+ KCU Sessions (3-week window)"`, `status = "PENDING"`, `createdAt = LocalDateTime.now()`
    - Assign to KCU leader user: stream `userRepository.findAll()`, filter by `assignedKcu.kcuId == member.kcu.kcuId`, `findFirst().ifPresent(followUp::setAssignedTo)`
    - Save via `followUpRepository.save(followUp)`
  - _Requirements: 3.2, 3.5, 3.6, 3.7, 3.8, 3.9_

  - [ ]* 14.1 Write property test for scheduler deduplication
    - **Property 6: Scheduler follow-up deduplication**
    - Set up a member with 2+ KCU absences and an existing PENDING follow-up; run `triggerWeeklyFollowUpGeneration()`; assert `followUpRepository.save` is never called for that member
    - **Validates: Requirements 3.5**

  - [ ]* 14.2 Write property test for scheduler follow-up creation correctness
    - **Property 7: Scheduler creates correctly-populated follow-ups**
    - Set up qualifying members (2+ KCU absences, no PENDING follow-up) with known KCU assignments; run the scheduler; assert each created `FollowUp` has the correct `reason`, `status`, and `assignedTo` user
    - **Validates: Requirements 3.6, 3.7**

- [~] 15. Checkpoint — Verify scheduler logic
  - Ensure all tests pass, ask the user if questions arise.

- [~] 16. Create MemberAudit entity
  - Create new file `src/main/java/com/church/cms/entity/MemberAudit.java`
  - Annotate with `@Entity`, `@Table(schema = "audit_log", name = "member_audit")`
  - Add Lombok annotations: `@Getter`, `@Setter`, `@NoArgsConstructor`, `@AllArgsConstructor`
  - Fields:
    - `@Id @GeneratedValue(strategy = GenerationType.IDENTITY) @Column(name = "audit_id") private Long auditId`
    - `@Column(name = "member_id", nullable = false, length = 50) private String memberId`
    - `@Column(name = "changed_by", nullable = false, length = 100) private String changedBy`
    - `@Column(name = "changed_at", nullable = false) private LocalDateTime changedAt`
    - `@Column(name = "operation", nullable = false, length = 20) private String operation`
    - `@Column(name = "diff_json", nullable = false, columnDefinition = "jsonb") private String diffJson`
  - _Requirements: 4.2, 4.13_

- [~] 17. Create MemberAuditRepository
  - Create new file `src/main/java/com/church/cms/repository/MemberAuditRepository.java`
  - Interface extending `JpaRepository<MemberAudit, Long>`
  - Add method: `List<MemberAudit> findByMemberIdOrderByChangedAtDesc(String memberId)`
  - Annotate with `@Repository`
  - _Requirements: 4.3_

- [~] 18. Add updateMember method to MemberService
  - Add `@Transactional public MemberSummaryDTO updateMember(String memberId, MemberRegistrationRequest req)` to `MemberService`
  - Load member via `memberRepository.findById(memberId).orElseThrow(...)`
  - Apply null-safe field updates for all mutable fields: `fullName`, `phone`, `gender`, `birthDate`, `maritalStatus`, `salvationStatus`, `salvationDate`, `baptismStatus`, `rightHandGiven`, `vipStatus`, `notes`
  - Apply zone update if `req.zoneId() != null`: load zone from `zoneRepository`, set on member
  - Apply KCU update if `req.kcuId() != null`: load KCU from `kcuRepository`, set on member
  - Call `memberRepository.save(member)` and return `toSummaryDTO(member)`
  - _Requirements: 4.4_

- [~] 19. Add PUT /api/members/{memberId} endpoint to MemberController
  - Add `@PutMapping("/{memberId}")` method to `MemberController`
  - Method signature: `public ResponseEntity<MemberSummaryDTO> updateMember(@PathVariable String memberId, @RequestBody @Valid MemberRegistrationRequest req)`
  - Delegate to `memberService.updateMember(memberId, req)` and return `ResponseEntity.ok(...)`
  - _Requirements: 4.5_

- [ ] 20. Create MemberAuditAspect
  - Create new file `src/main/java/com/church/cms/aspect/MemberAuditAspect.java`
  - Annotate with `@Aspect`, `@Component`, `@RequiredArgsConstructor`
  - Inject: `MemberRepository`, `MemberAuditRepository`, `SecurityContextHelper`, `ObjectMapper`
  - Implement `@Around("execution(* com.church.cms.service.MemberService.updateMember(String, ..))")` method `auditMemberUpdate(ProceedingJoinPoint pjp)`:
    - Extract `memberId = (String) pjp.getArgs()[0]`
    - Load `before` state: `memberRepository.findById(memberId).orElse(null)`, convert to `Map<String, Object>` via `toFieldMap()`
    - Call `pjp.proceed()` to execute the actual update
    - Load `after` state: `memberRepository.findById(memberId).orElse(null)`, convert to `Map<String, Object>`
    - Call `computeDiff(beforeMap, afterMap)` — returns `Map<String, Map<String, Object>>`
    - If diff is non-empty: build `MemberAudit` with `memberId`, `changedBy = securityContextHelper.getCurrentUser().getUsername()`, `changedAt = LocalDateTime.now()`, `operation = "UPDATE"`, `diffJson = objectMapper.writeValueAsString(diff)`; save via `memberAuditRepository.save(audit)`
    - Return the result of `pjp.proceed()`
  - Implement private `toFieldMap(Member m)`: returns `LinkedHashMap` with keys for all 14 tracked fields (see design.md Change 4 section)
  - Implement private `computeDiff(Map before, Map after)`: iterate `after` keys, add entry to diff map when `!Objects.equals(before.get(key), after.get(key))`
  - _Requirements: 4.6, 4.7, 4.8, 4.9, 4.10, 4.11, 4.12_

  - [ ]* 20.1 Write property test for audit diff correctness
    - **Property 8: Audit diff correctness**
    - Generate pairs of `Member` states with random field changes; call `computeDiff` (or invoke `updateMember` with mocked repos); assert the resulting `diff_json` contains exactly the changed fields with correct `before`/`after` values and no unchanged fields
    - **Validates: Requirements 4.8, 4.9**

  - [ ]* 20.2 Write property test for audit no-op on unchanged update
    - **Property 9: Audit no-op on unchanged update**
    - Invoke `updateMember` with a request that matches the current member state exactly; assert `MemberAuditRepository.save` is never called
    - **Validates: Requirements 4.12**

- [~] 21. Final checkpoint — Full integration verification
  - Ensure all tests pass, ask the user if questions arise.

## Task Dependency Graph

```json
{
  "waves": [
    {
      "wave": 1,
      "tasks": ["1", "5", "12", "13"]
    },
    {
      "wave": 2,
      "tasks": ["2", "6", "14", "18"]
    },
    {
      "wave": 3,
      "tasks": ["3", "7", "15", "19"]
    },
    {
      "wave": 4,
      "tasks": ["4", "8", "9", "16"]
    },
    {
      "wave": 5,
      "tasks": ["10", "17"]
    },
    {
      "wave": 6,
      "tasks": ["11", "20"]
    },
    {
      "wave": 7,
      "tasks": ["21"]
    }
  ]
}
```

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Flyway tasks (1–4) must be completed before any other tasks since they establish the `audit_log` schema needed by Change 4
- Change 2 tasks (5–11) are independent of Changes 3 and 4 and can be done in parallel
- Change 4 tasks (16–20) depend on Change 1 (audit_log schema must exist) but are otherwise independent
- The `ObjectMapper` bean is auto-configured by Spring Boot's `spring-boot-starter-web` — no additional configuration needed
- The `audit_log` schema is created by V1__init.sql; Hibernate `validate` mode will validate the `MemberAudit` entity against it on startup
