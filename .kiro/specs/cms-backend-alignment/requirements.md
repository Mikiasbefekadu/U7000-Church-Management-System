# Requirements Document

## Introduction

This document specifies the requirements for four backend alignment changes to the Church Management System (CMS) Spring Boot 4.x application. The changes bring the backend into conformance with the SDS/SRS specification by: (1) replacing Hibernate DDL with Flyway versioned migrations, (2) enforcing server-side KCU data-fence scoping on member profile and attendance endpoints, (3) introducing a weekly Sunday-night scheduler that auto-generates pastoral follow-ups for members with consecutive KCU absences, and (4) adding an AOP-based field-level audit trail for member profile updates.

## Glossary

- **Flyway**: An open-source database migration tool that applies versioned SQL scripts in order and tracks applied versions in `flyway_schema_history`.
- **KCU**: Home Cell Unit — the smallest organizational unit in the church hierarchy. Each KCU has one `KCU_LEADER` user.
- **KCU_LEADER**: A user role scoped to a single KCU. May only access data belonging to members in their assigned KCU.
- **JWT**: JSON Web Token — a signed token containing claims including `sub` (username), `role`, `kcuId`, and `zoneId`, issued at login by `AuthService`.
- **SecurityContextHelper**: A Spring component that resolves the current authenticated user's identity and scope from the `SecurityContext`.
- **JwtUtil**: A Spring component that generates and parses JWT tokens.
- **JwtAuthFilter**: A Spring Security `OncePerRequestFilter` that validates the Bearer token and populates the `SecurityContext`.
- **MemberService**: The service layer class responsible for member CRUD and profile operations.
- **AttendanceService**: The service layer class responsible for bulk attendance submission and the care engine.
- **FollowUpScheduler**: A new Spring `@Component` in `com.church.cms.scheduler` that runs on a cron schedule.
- **MemberAuditAspect**: A new Spring AOP `@Aspect` in `com.church.cms.aspect` that intercepts `updateMember` calls.
- **MemberAudit**: A JPA entity mapping to `audit_log.member_audit` that stores field-level change records.
- **diff_json**: A JSONB column storing a JSON object of the form `{"fieldName": {"before": oldValue, "after": newValue}}` for each changed field.
- **V1__init.sql**: The first Flyway migration script containing the full DDL for all 11 tables plus the `audit_log` schema.
- **V2__seed.sql**: The second Flyway migration script containing all seed data.
- **PENDING**: The initial status of a `FollowUp` record before a leader has acted on it.
- **AccessDeniedException**: `org.springframework.security.access.AccessDeniedException` — thrown when a user attempts to access data outside their authorized scope.

## Requirements

### Requirement 1: Flyway Migration Strategy

**User Story:** As a system administrator, I want database schema changes managed by Flyway versioned migrations, so that schema evolution is tracked, repeatable, and safe for production deployments.

#### Acceptance Criteria

1. THE System SHALL include `org.flywaydb:flyway-core` and `org.flywaydb:flyway-database-postgresql` as Maven dependencies in `pom.xml`.
2. WHEN the application starts, THE Flyway Engine SHALL execute `V1__init.sql` and `V2__seed.sql` from `classpath:db/migration` in version order if they have not already been applied.
3. THE `V1__init.sql` migration SHALL create all 11 core tables (`zones`, `kcus`, `ministries`, `competencies`, `members`, `children`, `attendance`, `follow_ups`, `member_ministries`, `member_competencies`, `users`), the deferred FK constraint `fk_followup_assigned_user`, all indexes defined in the original `schema.sql`, the `audit_log` schema, and the `audit_log.member_audit` table with its two indexes.
4. THE `V2__seed.sql` migration SHALL contain all seed data from the original `import.sql`, with every `INSERT` statement using `ON CONFLICT DO NOTHING` to ensure idempotent re-runs.
5. THE `application.properties` SHALL set `spring.jpa.hibernate.ddl-auto=validate`, `spring.flyway.enabled=true`, and `spring.flyway.locations=classpath:db/migration`.
6. THE `application.properties` SHALL NOT contain `spring.sql.init.mode`.
7. THE files `src/main/resources/schema.sql` and `src/main/resources/import.sql` SHALL be deleted from the project.
8. IF a Flyway migration script has been modified after it was applied, THEN THE Flyway Engine SHALL prevent application startup and report a checksum mismatch error.

### Requirement 2: Server-side KCU Scoping

**User Story:** As a security architect, I want KCU_LEADER users to be restricted to data within their assigned KCU at the service layer, so that cross-KCU data access is impossible regardless of the API call made.

#### Acceptance Criteria

1. THE `JwtUtil` SHALL expose a `extractKcuId(String token)` method that reads the `kcuId` claim from the JWT payload without a database query.
2. THE `JwtUtil` SHALL expose a `extractRole(String token)` method that reads the `role` claim from the JWT payload without a database query.
3. WHEN `JwtAuthFilter` authenticates a request, THE `JwtAuthFilter` SHALL store the raw JWT string as the `details` field of the `UsernamePasswordAuthenticationToken` placed in the `SecurityContext`.
4. THE `SecurityContextHelper` SHALL expose `getCurrentUserKcuIdFromJwt()`, `getCurrentUserRoleFromJwt()`, and `getCurrentUserZoneIdFromJwt()` methods that extract claims from the JWT stored in `Authentication.details` without issuing any SQL query to the `users` table.
5. WHEN `MemberService.getMemberProfile(String memberId)` is called and the current user's role is `KCU_LEADER`, THE `MemberService` SHALL verify that the loaded member's `kcu_id` equals the `kcuId` claim from the current user's JWT.
6. IF the current user's role is `KCU_LEADER` and the requested member's `kcu_id` does not equal the leader's `kcuId` JWT claim, THEN THE `MemberService` SHALL throw `AccessDeniedException` with message `"Access denied: member not in your KCU"`.
7. WHEN `AttendanceService.submitBulkAttendance(List<AttendanceSubmissionDTO>)` is called and the current user's role is `KCU_LEADER`, THE `AttendanceService` SHALL verify that every member in the submission list belongs to the leader's KCU before persisting any attendance record.
8. IF any member in the attendance submission batch has a `kcu_id` that does not equal the `KCU_LEADER`'s `kcuId` JWT claim, THEN THE `AttendanceService` SHALL throw `AccessDeniedException` and persist zero attendance records from that batch.
9. WHILE the current user's role is `ADMIN` or `PASTOR`, THE `MemberService` and `AttendanceService` SHALL apply no KCU scope restriction.
10. THE `MemberService` scope resolver methods (`resolveKcuScope`, `resolveZoneScope`) SHALL use the JWT-direct methods from `SecurityContextHelper` instead of the DB-backed `getCurrentUser()` method.

### Requirement 3: Sunday 11 PM Follow-Up Scheduler

**User Story:** As a pastoral care coordinator, I want the system to automatically generate follow-up tasks every Sunday night for members who have missed 2 or more KCU sessions in the past 3 weeks, so that no at-risk member is overlooked.

#### Acceptance Criteria

1. THE `CmsApplication` class SHALL be annotated with `@EnableScheduling`.
2. THE System SHALL contain a `@Component` class `com.church.cms.scheduler.FollowUpScheduler` with a method annotated `@Scheduled(cron = "0 0 23 * * SUN")`.
3. WHEN the scheduler fires, THE `FollowUpScheduler` SHALL query `AttendanceRepository` for member IDs that have 2 or more `ABSENT` records with `event_type = 'KCU'` within the trailing 21-day window from the current date.
4. THE `AttendanceRepository` SHALL expose a JPQL query method `findMembersWithConsecutiveKcuAbsences(LocalDate since)` that returns `List<String>` of member IDs meeting the criteria in acceptance criterion 3.
5. FOR each member ID returned by the query, IF a `FollowUp` record with `status = 'PENDING'` already exists for that member, THEN THE `FollowUpScheduler` SHALL skip that member and not create a duplicate follow-up.
6. FOR each qualifying member without an existing `PENDING` follow-up, THE `FollowUpScheduler` SHALL create a new `FollowUp` entity with `reason = "Missed 2+ KCU Sessions (3-week window)"`, `status = "PENDING"`, and `createdAt = LocalDateTime.now()`.
7. WHEN creating a follow-up, THE `FollowUpScheduler` SHALL assign it to the `User` whose `assigned_kcu_id` matches the member's `kcu_id`, if such a user exists.
8. THE `FollowUpScheduler.triggerWeeklyFollowUpGeneration()` method SHALL be annotated with `@Transactional`.
9. THE scheduler SHALL NOT create follow-ups based on `SUNDAY`, `WEDNESDAY`, or `SPECIAL` event type absences — only `KCU` absences count toward the threshold.

### Requirement 4: AOP Audit Trail Aspect

**User Story:** As a compliance officer, I want every update to a member's profile to be recorded with a field-level diff in an audit log, so that I can trace who changed what and when.

#### Acceptance Criteria

1. THE `pom.xml` SHALL include `spring-boot-starter-aop` as a Maven dependency.
2. THE System SHALL contain a JPA entity `com.church.cms.entity.MemberAudit` mapped to `audit_log.member_audit` using `@Table(schema = "audit_log", name = "member_audit")`.
3. THE System SHALL contain a Spring Data JPA repository `com.church.cms.repository.MemberAuditRepository` extending `JpaRepository<MemberAudit, Long>`.
4. THE `MemberService` SHALL expose a `@Transactional` method `updateMember(String memberId, MemberRegistrationRequest req)` that loads the existing member, applies non-null fields from the request, saves the updated member, and returns a `MemberSummaryDTO`.
5. THE `MemberController` SHALL expose a `PUT /api/members/{memberId}` endpoint that delegates to `MemberService.updateMember`.
6. THE System SHALL contain an `@Aspect @Component` class `com.church.cms.aspect.MemberAuditAspect` with an `@Around` advice on `execution(* com.church.cms.service.MemberService.updateMember(String, ..))`.
7. WHEN `MemberService.updateMember` is invoked, THE `MemberAuditAspect` SHALL load the member's current state before the update proceeds.
8. WHEN `MemberService.updateMember` completes successfully, THE `MemberAuditAspect` SHALL load the member's updated state, compute a field-level diff, and persist a `MemberAudit` record if at least one field changed.
9. THE `diff_json` field of the persisted `MemberAudit` SHALL be a JSON object where each key is a changed field name and each value is an object with `"before"` and `"after"` sub-keys containing the old and new values respectively.
10. THE `MemberAudit.changedBy` field SHALL be populated from `SecurityContextHelper.getCurrentUser().getUsername()`.
11. THE `MemberAudit.operation` field SHALL always be set to `"UPDATE"`.
12. IF no fields changed between the before and after states, THEN THE `MemberAuditAspect` SHALL NOT persist any `MemberAudit` record.
13. THE `MemberAudit` entity SHALL use `@GeneratedValue(strategy = GenerationType.IDENTITY)` for its `audit_id` primary key.
