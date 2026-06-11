package com.church.cms.controller;

import com.church.cms.dto.attendance.AttendanceSubmissionDTO;
import com.church.cms.service.AttendanceService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/attendance")
@RequiredArgsConstructor
public class AttendanceController {

    private final AttendanceService attendanceService;

    /**
     * POST /api/attendance/submit
     * Accepts a bulk array of attendance records for a session.
     * Automatically triggers the Care Engine after saving.
     *
     * Body: List<AttendanceSubmissionDTO>
     */
    @PostMapping("/submit")
    public ResponseEntity<Map<String, String>> submitAttendance(
            @Valid @RequestBody List<AttendanceSubmissionDTO> submissions) {
        attendanceService.submitBulkAttendance(submissions);
        return ResponseEntity.ok(Map.of(
                "status", "success",
                "message", submissions.size() + " attendance records saved. Care engine triggered."));
    }
}
