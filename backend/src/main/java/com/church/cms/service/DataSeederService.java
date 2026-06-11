package com.church.cms.service;

import com.church.cms.entity.Kcu;
import com.church.cms.entity.Zone;
import com.church.cms.repository.KcuRepository;
import com.church.cms.repository.ZoneRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.InputStream;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * Parses KCUs.xlsx from the classpath and seeds the kcus table.
 *
 * <p>Spreadsheet column layout (0-indexed):
 * <pre>
 *  0  kcu_id          — formula / string code, IGNORED (DB auto-assigns)
 *  1  kcu_name        — String
 *  2  zone_id         — String code, e.g. "Z001" → looked up in zones table
 *  3  kcu_type        — "GENERAL" | "YOUNG_ADULT"
 *  4  Kcu_Leader      — String
 *  5  Assistant       — String
 *  6  Leader_phone    — String
 *  7  Assistant_phone — String
 *  8  (meeting_day)   — String (header is a day name, e.g. "Thursday")
 *  9  meeting_time    — LocalTime / numeric fraction
 * 10  Location        — String
 * </pre>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DataSeederService implements CommandLineRunner {

    private static final String EXCEL_PATH = "data/KCUs.xlsx";

    private final KcuRepository kcuRepository;
    private final ZoneRepository zoneRepository;

    /**
     * Runs automatically on application startup.
     * Seeds KCU data from KCUs.xlsx only when the kcus table is empty,
     * so it is safe to restart the application without creating duplicates.
     */
    @Override
    public void run(String... args) {
        if (kcuRepository.count() == 0) {
            log.info("KCU table is empty — auto-seeding from {}", EXCEL_PATH);
            String result = seedKcuDataFromExcel();
            log.info("Auto-seed result: {}", result);
        } else {
            log.info("KCU table already populated ({} rows) — skipping auto-seed",
                kcuRepository.count());
        }
    }

    /**
     * Reads KCUs.xlsx from {@code src/main/resources/data/} and persists every
     * data row as a {@link Kcu} record.  The spreadsheet's kcu_id column is
     * intentionally skipped so PostgreSQL auto-assigns numeric IDs.
     *
     * @return a summary message with counts of saved and skipped rows
     */
    @Transactional
    public String seedKcuDataFromExcel() {
        int saved = 0;
        int skipped = 0;
        List<String> errors = new ArrayList<>();

        ClassPathResource resource = new ClassPathResource(EXCEL_PATH);
        if (!resource.exists()) {
            throw new IllegalStateException(
                "KCUs.xlsx not found on classpath at: " + EXCEL_PATH);
        }

        try (InputStream is = resource.getInputStream();
             Workbook workbook = new XSSFWorkbook(is)) {

            Sheet sheet = workbook.getSheetAt(0);
            int lastRow = sheet.getLastRowNum();
            log.info("KCU seeder: found {} rows (including header)", lastRow);

            // Row 0 is the header — start from row 1
            for (int rowIdx = 1; rowIdx <= lastRow; rowIdx++) {
                Row row = sheet.getRow(rowIdx);
                if (row == null) {
                    skipped++;
                    continue;
                }

                // col 1 = kcu_name — skip blank rows
                String kcuName = getCellString(row, 1);
                if (kcuName == null || kcuName.isBlank()) {
                    skipped++;
                    continue;
                }

                try {
                    Kcu kcu = new Kcu();

                    // col 0 (kcu_id) — intentionally ignored; DB auto-assigns

                    // col 1 — kcu_name
                    kcu.setKcuName(kcuName.trim());

                    // col 2 — zone_id: look up the Zone entity by its business code
                    String zoneCode = getCellString(row, 2);
                    if (zoneCode != null && !zoneCode.isBlank()) {
                        final String capturedZoneCode = zoneCode.trim();
                        final String capturedKcuName = kcuName;
                        final int capturedRowNum = rowIdx + 1;
                        Optional<Zone> zone = zoneRepository.findById(capturedZoneCode);
                        zone.ifPresentOrElse(
                            kcu::setZone,
                            () -> log.warn("Row {}: zone '{}' not found — kcu_name='{}' saved without zone",
                                capturedRowNum, capturedZoneCode, capturedKcuName)
                        );
                    }

                    // col 3 — kcu_type
                    String kcuType = getCellString(row, 3);
                    kcu.setKcuType(kcuType != null && !kcuType.isBlank()
                        ? kcuType.trim().toUpperCase()
                        : "GENERAL");

                    // col 4 — Kcu_Leader
                    kcu.setKcuLeader(getCellString(row, 4));

                    // col 5 — Assistant
                    kcu.setAssistant(getCellString(row, 5));

                    // col 6 — Leader_phone
                    kcu.setLeaderPhone(getCellString(row, 6));

                    // col 7 — Assistant_phone
                    kcu.setAssistantPhone(getCellString(row, 7));

                    // col 8 — meeting_day (header cell contains a day name like "Thursday")
                    kcu.setMeetingDay(getCellString(row, 8));

                    // col 9 — meeting_time (stored as a time fraction or LocalTime by POI)
                    kcu.setMeetingTime(parseMeetingTime(row, 9));

                    // col 10 — Location
                    kcu.setLocation(getCellString(row, 10));

                    kcuRepository.save(kcu);
                    saved++;

                } catch (Exception e) {
                    String msg = String.format("Row %d skipped due to error: %s", rowIdx + 1, e.getMessage());
                    log.error(msg, e);
                    errors.add(msg);
                    skipped++;
                }
            }

        } catch (Exception e) {
            throw new RuntimeException("Failed to parse KCUs.xlsx: " + e.getMessage(), e);
        }

        String summary = String.format(
            "KCU seeding complete — saved: %d, skipped: %d%s",
            saved, skipped,
            errors.isEmpty() ? "" : "; errors: " + errors
        );
        log.info(summary);
        return summary;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /**
     * Returns the string value of a cell regardless of its type.
     * Formula cells are evaluated; numeric cells are formatted without decimals
     * when the value is a whole number (handles phone numbers stored as numbers).
     */
    private String getCellString(Row row, int colIdx) {
        Cell cell = row.getCell(colIdx, Row.MissingCellPolicy.RETURN_BLANK_AS_NULL);
        if (cell == null) return null;

        return switch (cell.getCellType()) {
            case STRING  -> cell.getStringCellValue().trim();
            case NUMERIC -> {
                double d = cell.getNumericCellValue();
                // Whole numbers (phone numbers, etc.) — avoid "9.1318595E8" style
                yield d == Math.floor(d) && !Double.isInfinite(d)
                    ? String.valueOf((long) d)
                    : String.valueOf(d);
            }
            case BOOLEAN -> String.valueOf(cell.getBooleanCellValue());
            case FORMULA -> {
                // Evaluate the formula and return its cached string result
                try {
                    yield cell.getStringCellValue().trim();
                } catch (Exception ex) {
                    double d = cell.getNumericCellValue();
                    yield d == Math.floor(d) && !Double.isInfinite(d)
                        ? String.valueOf((long) d)
                        : String.valueOf(d);
                }
            }
            default -> null;
        };
    }

    /**
     * Parses the meeting_time cell.  POI represents Excel time values as a
     * fractional day (e.g. 0.75 = 18:00).  If the cell is already a string
     * (e.g. "18:00") it is returned as-is.
     */
    private String parseMeetingTime(Row row, int colIdx) {
        Cell cell = row.getCell(colIdx, Row.MissingCellPolicy.RETURN_BLANK_AS_NULL);
        if (cell == null) return null;

        if (cell.getCellType() == CellType.NUMERIC
                || cell.getCellType() == CellType.FORMULA) {
            try {
                // DateUtil converts the fractional day to a java.util.Date
                if (DateUtil.isCellDateFormatted(cell)) {
                    java.util.Date d = cell.getDateCellValue();
                    // Extract HH:mm from the date
                    LocalTime lt = d.toInstant()
                        .atZone(java.time.ZoneId.systemDefault())
                        .toLocalTime();
                    return lt.format(DateTimeFormatter.ofPattern("HH:mm"));
                }
                // Fallback: treat as fractional day
                double fraction = cell.getNumericCellValue();
                int totalMinutes = (int) Math.round(fraction * 24 * 60);
                LocalTime lt = LocalTime.of(totalMinutes / 60 % 24, totalMinutes % 60);
                return lt.format(DateTimeFormatter.ofPattern("HH:mm"));
            } catch (Exception e) {
                log.warn("Could not parse meeting_time at col {}: {}", colIdx, e.getMessage());
                return null;
            }
        }

        // String cell — return as-is
        return cell.getStringCellValue().trim();
    }
}
