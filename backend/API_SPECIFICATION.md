# API Specification — Leadership Gold Church Management System

**Base URL:** `http://localhost:8080`
**Auth:** All endpoints except `/api/auth/login` require `Authorization: Bearer <token>` header.
**Date format:** ISO-8601 strings — `"YYYY-MM-DD"` for dates, `"YYYY-MM-DDTHH:mm:ss"` for timestamps.
**CORS:** Allowed origins: `http://localhost:3000`, `http://localhost:5173`, `http://127.0.0.1:3000`

---

## RBAC Data Fence — How It Works

Every authenticated request is silently scoped by the caller's role. The frontend does not need to send scope parameters — the backend injects them automatically.

| Role | Data Visibility |
|---|---|
| `ADMIN` / `PASTOR` | Full database — all zones, all KCUs |
| `ZONE_LEADER` | Only members, attendance, and reports within their assigned zone |
| `KCU_LEADER` | Only members and attendance within their assigned KCU |

The `role`, `assignedZoneId`, and `assignedKcuId` fields returned at login tell the frontend which UI panels to show or hide.

---

## 1. Authentication — `/api/auth`

### POST `/api/auth/login`

Public endpoint. No token required.

**Request Body:**
```json
{
  "username": "admin",
  "password": "password123"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `username` | string | ✅ | Must not be blank |
| `password` | string | ✅ | Must not be blank |

**Response `200 OK`:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiQURNSU4iLCJ6b25lSWQiOiIiLCJrY3VJZCI6IiIsInN1YiI6ImFkbWluIiwiaWF0IjoxNzE2MTM5MjAwLCJleHAiOjE3MTYyMjU2MDB9.SIGNATURE",
  "userId": "U001",
  "username": "admin",
  "role": "ADMIN",
  "assignedZoneId": null,
  "assignedKcuId": null
}
```

| Field | Type | Notes |
|---|---|---|
| `token` | string | JWT — store in memory or `httpOnly` cookie. Send as `Authorization: Bearer <token>` |
| `userId` | string | Internal user ID |
| `username` | string | |
| `role` | string | `ADMIN` \| `PASTOR` \| `ZONE_LEADER` \| `KCU_LEADER` — use for client-side route guards |
| `assignedZoneId` | string \| null | Non-null for `ZONE_LEADER`. Use to pre-filter zone dropdowns |
| `assignedKcuId` | string \| null | Non-null for `KCU_LEADER`. Use to pre-filter KCU dropdowns |

**Error `401 Unauthorized`:**
```json
{
  "status": 401,
  "error": "Unauthorized",
  "message": "Bad credentials"
}
```

**Frontend usage:**
```js
// Store token after login
localStorage.setItem('cms_token', response.token);

// Attach to every subsequent request
headers: { 'Authorization': `Bearer ${localStorage.getItem('cms_token')}` }
```

---

## 2. Dashboard Overview — `/api/dashboard`

### GET `/api/dashboard/kpis`

Returns the 7 KPI counter blocks for the unified dashboard header. All counts are pre-scoped by the caller's RBAC fence — no query params needed.

**Request:** No body. Auth header required.

**Response `200 OK`:**
```json
{
  "totalActiveMembers": 248,
  "newMembersThisMonth": 7,
  "newMembersThisYear": 43,
  "pendingFollowUps": 12,
  "membersWithNoKcu": 5,
  "leadershipAnomalies": 2,
  "talentNotServing": 8
}
```

| Field | Type | Dashboard Card | Alert Level |
|---|---|---|---|
| `totalActiveMembers` | number | Active Members | — |
| `newMembersThisMonth` | number | New This Month | — |
| `newMembersThisYear` | number | New This Year | — |
| `pendingFollowUps` | number | Care Cases | 🟡 Warn if > 0 |
| `membersWithNoKcu` | number | Structural Gap | 🟡 Warn if > 0 |
| `leadershipAnomalies` | number | Leadership Alert | 🔴 Red if > 0 |
| `talentNotServing` | number | Talent Bench | 🟡 Warn if > 0 |

---

## 3. Members Hub — `/api/members`

### GET `/api/members`

Paginated, server-side filtered member list. RBAC fence applied automatically.

**Query Parameters:**

| Param | Type | Required | Example | Notes |
|---|---|---|---|---|
| `zoneId` | string | ❌ | `Z001` | Ignored for `KCU_LEADER` (overridden by their KCU scope) |
| `kcuId` | string | ❌ | `KCU001` | Ignored for `KCU_LEADER` (forced to their own KCU) |
| `gender` | string | ❌ | `Male` | `Male` \| `Female` |
| `status` | string | ❌ | `Active` | `Active` \| `Inactive` |
| `marital` | string | ❌ | `Single` | `Single` \| `Married` |
| `page` | number | ❌ | `0` | Zero-indexed. Default: `0` |
| `size` | number | ❌ | `20` | Default: `20` |
| `sort` | string | ❌ | `fullName,asc` | Default: `fullName,asc` |

**Response `200 OK` — Spring Page wrapper:**
```json
{
  "content": [
    {
      "memberId": "M001",
      "fullName": "Abebe Girma",
      "phone": "0911100001",
      "gender": "Male",
      "birthDate": "1985-03-15",
      "maritalStatus": "Married",
      "memberStatus": "Active",
      "vipStatus": "Completed",
      "baptismStatus": "Baptized",
      "zoneName": "Zone 1",
      "kcuName": "Bole Alpha Cell"
    }
  ],
  "pageable": {
    "pageNumber": 0,
    "pageSize": 20,
    "sort": { "sorted": true, "unsorted": false }
  },
  "totalElements": 248,
  "totalPages": 13,
  "last": false,
  "first": true,
  "numberOfElements": 20
}
```

---

### GET `/api/members/{memberId}`

Full profile drilldown — used by the Member Profile page.

**Response `200 OK`:**
```json
{
  "memberId": "M011",
  "fullName": "Solomon Negash",
  "phone": "0911300001",
  "gender": "Male",
  "birthDate": "1980-01-20",
  "maritalStatus": "Married",
  "memberStatus": "Active",
  "joinDate": "2005-09-11",
  "notes": null,

  "salvationStatus": 1,
  "salvationDate": "2005-09-11",
  "baptismStatus": "Baptized",
  "rightHandGiven": "Yes",
  "vipStatus": "Completed",

  "zoneId": "Z003",
  "zoneName": "Zone 3",
  "kcuId": "KCU005",
  "kcuName": "Yeka Grace Cell",

  "partnerId": "M012",
  "partnerName": "Almaz Teshome",

  "children": [
    { "childId": "CH001", "childName": "Yohannes Solomon", "childDob": "2008-03-15", "childGender": "Male" },
    { "childId": "CH002", "childName": "Ruth Solomon",     "childDob": "2011-09-22", "childGender": "Female" }
  ],

  "ministries": ["Prayer Ministry"],
  "competencies": []
}
```

---

### POST `/api/members/register`

Transactional registration wizard. Saves member + children + ministry + competency assignments atomically. Returns `201 Created`.

**Request Body:**
```json
{
  "memberId": "M013",
  "fullName": "Eyerusalem Tefera",
  "phone": "0911400003",
  "gender": "Female",
  "birthDate": "1995-08-20",
  "maritalStatus": "Single",
  "partnerId": null,

  "zoneId": "Z004",
  "kcuId": "KCU007",

  "salvationStatus": 1,
  "salvationDate": "2020-04-05",
  "baptismStatus": "Baptized",
  "rightHandGiven": "Yes",
  "vipStatus": "In Progress",

  "children": [],

  "ministryIds": ["MIN04"],
  "competencyIds": ["COMP09"],

  "notes": "Transferred from Bahir Dar branch"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `memberId` | string | ✅ | Must be unique. Recommend format: `M` + zero-padded number |
| `fullName` | string | ✅ | |
| `phone` | string | ✅ | Must be unique across all members |
| `gender` | string | ✅ | `Male` \| `Female` |
| `birthDate` | string | ❌ | `YYYY-MM-DD` |
| `maritalStatus` | string | ❌ | `Single` \| `Married` |
| `partnerId` | string | ❌ | Must be an existing `memberId` |
| `zoneId` | string | ❌ | Null = structural gap (no KCU assigned yet) |
| `kcuId` | string | ❌ | Null = structural gap |
| `salvationStatus` | number | ❌ | `0` = No, `1` = Yes. Default: `0` |
| `salvationDate` | string | ❌ | `YYYY-MM-DD` |
| `baptismStatus` | string | ❌ | `Baptized` \| `Candidate` \| `null` |
| `rightHandGiven` | string | ❌ | `Yes` \| `No` |
| `vipStatus` | string | ❌ | `Not Started` \| `In Progress` \| `Completed` |
| `children` | array | ❌ | Array of child objects (see below). Empty array `[]` if none |
| `ministryIds` | array | ❌ | Array of `min_id` strings e.g. `["MIN01", "MIN05"]` |
| `competencyIds` | array | ❌ | Array of `comp_id` strings e.g. `["COMP01", "COMP03"]` |
| `notes` | string | ❌ | Free text |

**Child object shape:**
```json
{
  "childId": null,
  "childName": "Liya Tesfaye",
  "childDob": "2022-01-10",
  "childGender": "Female"
}
```
`childId` can be `null` — the backend generates a UUID automatically.

**Response `201 Created`:** Returns a `MemberSummaryDTO` (same shape as the list view item).

---

## 4. Bulk Attendance Hub — `/api/attendance`

### POST `/api/attendance/submit`

The primary endpoint for the Attendance Hub Grid. Accepts a flat array — one object per member per session. After saving, the Care Engine runs automatically and generates `FollowUp` records for any member with 2+ absences in the last 2 weeks.

**Request Body — `application/json`:**
```json
[
  {
    "memberId": "M001",
    "eventType": "SUNDAY",
    "attDate": "2026-05-18",
    "status": "PRESENT"
  },
  {
    "memberId": "M002",
    "eventType": "SUNDAY",
    "attDate": "2026-05-18",
    "status": "PRESENT"
  },
  {
    "memberId": "M008",
    "eventType": "SUNDAY",
    "attDate": "2026-05-18",
    "status": "ABSENT"
  }
]
```

| Field | Type | Required | Allowed Values |
|---|---|---|---|
| `memberId` | string | ✅ | Must be an existing member ID |
| `eventType` | string | ✅ | `KCU` \| `SUNDAY` \| `WEDNESDAY` \| `SPECIAL` |
| `attDate` | string | ✅ | `YYYY-MM-DD` — the date of the session |
| `status` | string | ✅ | `PRESENT` \| `ABSENT` |

**Response `200 OK`:**
```json
{
  "status": "success",
  "message": "3 attendance records saved. Care engine triggered."
}
```

**Error `400 Bad Request`** (validation failure — e.g. blank memberId):
```json
{
  "status": 400,
  "error": "Bad Request",
  "message": "memberId: must not be blank"
}
```

**Frontend grid construction pattern:**
```
1. Call GET /api/admin/kcus?zoneId=Z001 → get list of KCUs
2. Call GET /api/members?kcuId=KCU001&status=Active&size=100 → get member list
3. Render grid: rows = members, columns = sessions
4. On submit: map each cell to one AttendanceSubmissionDTO object
5. POST the full array to /api/attendance/submit
```

---

## 5. Follow-Up Care Worklist — `/api/followups`

### GET `/api/followups`

Returns the PENDING worklist. Automatically scoped by role — no params needed.

**Response `200 OK`:**
```json
[
  {
    "followupId": "FU001",
    "memberId": "M008",
    "memberName": "Mekdes Alemu",
    "memberPhone": "0911200001",
    "kcuName": "Kirkos Faithful Cell",
    "reason": "Absent 2+ Weeks",
    "status": "PENDING",
    "assignedToUserId": "U004",
    "assignedToName": "kcu1leader",
    "notes": "Member has not attended Sunday service or KCU for 3 consecutive sessions.",
    "createdAt": "2026-05-15T10:30:00"
  }
]
```

### GET `/api/followups/overdue`

Same shape as above. Returns only cases where `createdAt` is older than 72 hours and status is still `PENDING`.

### PATCH `/api/followups/{followupId}`

Leader resolves a care case from the worklist.

**Request Body:**
```json
{
  "status": "RESOLVED",
  "notes": "Called member on 2026-05-19. She was travelling. Will return next Sunday."
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `status` | string | ✅ | `PENDING` \| `RESOLVED` |
| `notes` | string | ❌ | Appended to the care record |

**Response `200 OK`:** Returns the updated `FollowUpDTO`.

---

## 6. Pastoral Report Center — `/api/reports`

All report endpoints are `GET`, require auth, and are RBAC-scoped automatically.

---

### GET `/api/reports/membership`

Category A — Membership Health.

**Response `200 OK`:**
```json
{
  "totalActive": 248,
  "totalInactive": 14,
  "newThisMonth": 7,
  "newThisQuarter": 19,
  "newThisYear": 43,
  "membersWithNoKcu": 5,
  "genderDistribution": {
    "Male": 112,
    "Female": 136
  },
  "ageDistribution": {
    "Children": 8,
    "Youth": 34,
    "Young Adults": 97,
    "Adults": 89,
    "Seniors": 20
  },
  "maritalStatusDistribution": {
    "Single": 143,
    "Married": 105
  },
  "locationDistribution": {
    "Bole, Addis Ababa": 67,
    "Kirkos, Addis Ababa": 54,
    "Yeka, Addis Ababa": 71,
    "Nifas Silk, Addis Ababa": 56
  }
}
```

---

### GET `/api/reports/attendance?from=YYYY-MM-DD&to=YYYY-MM-DD`

Category B — Attendance & Engagement.

**Query Parameters:**

| Param | Required | Default | Notes |
|---|---|---|---|
| `from` | ❌ | 90 days ago | `YYYY-MM-DD` |
| `to` | ❌ | today | `YYYY-MM-DD` |

**Response `200 OK`:**
```json
{
  "averageRateByEventType": {
    "SUNDAY": 0.82,
    "KCU": 0.74,
    "WEDNESDAY": 0.61,
    "SPECIAL": 0.91
  },
  "weeklyTrend": [
    { "date": "2026-05-04", "presentCount": 198 },
    { "date": "2026-05-11", "presentCount": 204 },
    { "date": "2026-05-18", "presentCount": 211 }
  ],
  "absentTwoPlusWeeks": [
    {
      "memberId": "M008",
      "fullName": "Mekdes Alemu",
      "phone": "0911200001",
      "gender": "Female",
      "birthDate": "1993-02-08",
      "maritalStatus": "Single",
      "memberStatus": "Active",
      "vipStatus": "In Progress",
      "baptismStatus": "Baptized",
      "zoneName": "Zone 2",
      "kcuName": "Kirkos Faithful Cell"
    }
  ],
  "absentOneMonth": []
}
```

---

### GET `/api/reports/spiritual`

Category D — Spiritual Growth + **Leadership Anomaly Rule**.

**Response `200 OK`:**
```json
{
  "totalWithSalvation": 231,
  "totalWithoutSalvation": 17,
  "salvationsByMonth": {
    "2026-01": 3,
    "2026-02": 5,
    "2026-03": 4,
    "2026-04": 6,
    "2026-05": 3
  },
  "totalBaptized": 198,
  "totalNotBaptized": 50,
  "baptismCandidates": 14,
  "vipStatusDistribution": {
    "Not Started": 89,
    "In Progress": 76,
    "Completed": 83
  },
  "leadershipAnomalies": [
    {
      "memberId": "M002",
      "fullName": "Dawit Tesfaye",
      "phone": "0911100003",
      "vipStatus": "In Progress",
      "zoneName": "Zone 1",
      "kcuName": "Bole Young Adults",
      "ministriesServing": ["Worship Ministry"]
    },
    {
      "memberId": "M003",
      "fullName": "Sara Bekele",
      "phone": "0911100004",
      "vipStatus": "Not Started",
      "zoneName": "Zone 1",
      "kcuName": "Bole Young Adults",
      "ministriesServing": ["Media Ministry"]
    }
  ]
}
```

**Frontend usage for the anomaly list:**
- Render `leadershipAnomalies` as a high-priority exception table
- `vipStatus` drives the badge color: `Not Started` = 🔴 red, `In Progress` = 🟡 amber
- `ministriesServing` is an array — a member can serve in multiple ministries

---

### GET `/api/reports/talent?skill=Music`

Category E — Ministry Densities + **Talent Utilization Scanner**.

**Query Parameters:**

| Param | Required | Notes |
|---|---|---|
| `skill` | ❌ | Keyword filter on competency name. Case-insensitive partial match. Omit to return all undeployed members with any skill. |

**Response `200 OK`:**
```json
{
  "ministryDensities": {
    "Children Ministry": 18,
    "Worship Ministry": 24,
    "Media Ministry": 11,
    "Prayer Ministry": 31,
    "Women Ministry": 22,
    "Men Ministry": 19,
    "Youth Ministry": 27,
    "Sound Engineering Ministry": 9,
    "Ushering Ministry": 14,
    "Counseling Ministry": 8,
    "Welfare Ministry": 12,
    "Preaching Ministry": 16,
    "Technology Ministry": 7
  },
  "talentNotServing": [
    {
      "memberId": "M004",
      "fullName": "Hana Worku",
      "phone": "0911200003",
      "zoneName": "Zone 2",
      "kcuName": "Kirkos Youth Cell",
      "skills": ["Music", "Video Editing"]
    },
    {
      "memberId": "M005",
      "fullName": "Bereket Assefa",
      "phone": "0911200004",
      "zoneName": "Zone 2",
      "kcuName": "Kirkos Youth Cell",
      "skills": ["Sound Engineering", "Teaching"]
    }
  ]
}
```

**Frontend usage for the talent scanner:**
- `ministryDensities` feeds a bar chart — keys are ministry names, values are member counts
- `talentNotServing` renders as an actionable table with an "Invite to Serve" button per row
- Use `?skill=Music` to filter the scanner to musicians only, `?skill=Sound` for audio team, etc.

---

## 7. Admin Panel — `/api/admin`

Restricted to `ROLE_ADMIN` and `ROLE_PASTOR`. All endpoints follow standard REST CRUD patterns.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/admin/zones` | List all zones |
| `POST` | `/api/admin/zones` | Create zone |
| `PUT` | `/api/admin/zones/{zoneId}` | Update zone |
| `DELETE` | `/api/admin/zones/{zoneId}` | Delete zone |
| `GET` | `/api/admin/kcus?zoneId=Z001` | List KCUs (optional zone filter) |
| `POST` | `/api/admin/kcus` | Create KCU |
| `PUT` | `/api/admin/kcus/{kcuId}` | Update KCU |
| `DELETE` | `/api/admin/kcus/{kcuId}` | Delete KCU |
| `GET` | `/api/admin/ministries` | List all ministries |
| `POST` | `/api/admin/ministries` | Create ministry |
| `GET` | `/api/admin/competencies` | List all competencies |
| `POST` | `/api/admin/competencies` | Create competency |
| `GET` | `/api/admin/users` | List all user accounts |
| `POST` | `/api/admin/users` | Create user account |
| `PATCH` | `/api/admin/users/{userId}/reset-password` | Reset password |

---

## 8. Error Response Format

All errors follow a consistent shape from Spring's default error handler:

```json
{
  "timestamp": "2026-05-19T17:00:00.000+00:00",
  "status": 403,
  "error": "Forbidden",
  "path": "/api/admin/zones"
}
```

| HTTP Status | Cause |
|---|---|
| `400` | Validation failure (`@NotBlank`, `@NotNull` violated) |
| `401` | Missing or expired JWT token |
| `403` | Valid token but insufficient role for the endpoint |
| `404` | Entity not found (member, followup, etc.) |
| `409` | Unique constraint violation (duplicate phone, duplicate attendance record) |
| `500` | Unexpected server error |
