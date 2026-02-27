package com.optiwms.coreapi.reports;

import com.optiwms.coreapp.reports.ReportsService;
import com.optiwms.domain.reports.Report;
import com.optiwms.domain.reports.ScheduledReport;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/reports")
public class ReportsController {

    private final ReportsService service;

    public ReportsController(ReportsService service) {
        this.service = service;
    }

    // Reports Endpoints
    @GetMapping
    public ResponseEntity<List<ReportDto>> getAllReports(
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String status
    ) {
        List<Report> reports = service.getAllReports(type, status);
        List<ReportDto> dtos = reports.stream()
                .map(this::toDto)
                .collect(Collectors.toList());
        return ResponseEntity.ok(dtos);
    }

    @GetMapping("/{id}")
    public ResponseEntity<ReportDto> getReportById(@PathVariable UUID id) {
        try {
            Report report = service.getReportById(id);
            return ResponseEntity.ok(toDto(report));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping("/generate")
    public ResponseEntity<ReportDto> generateReport(@RequestBody GenerateReportRequest request) {
        try {
            Report report = new Report();
            report.setReportName(request.reportName());
            report.setReportType(request.reportType());
            report.setDescription(request.description());
            report.setReportConfig(request.reportConfig());
            report.setCreatedBy(request.createdBy());
            // In a real implementation, this would trigger actual report generation
            // For now, we just create the report record

            Report created = service.createReport(report);
            return ResponseEntity.status(HttpStatus.CREATED).body(toDto(created));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PostMapping("/export")
    public ResponseEntity<byte[]> exportReport(@RequestBody ExportReportRequest request) {
        try {
            ReportsService.ExportedReportFile exported = service.exportReport(
                    request.reportType(),
                    request.format(),
                    request.createdBy()
            );

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.parseMediaType(exported.contentType()));
            headers.setContentLength(exported.fileSizeBytes());
            headers.set(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + exported.fileName() + "\"");
            headers.set("X-Report-Id", exported.reportId().toString());
            headers.set("X-Report-Type", exported.reportType());
            headers.set("X-Report-Format", exported.format());

            return new ResponseEntity<>(exported.content(), headers, HttpStatus.OK);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @GetMapping("/{id}/download")
    public ResponseEntity<String> downloadReport(@PathVariable UUID id) {
        try {
            Report report = service.getReportById(id);
            if (report.getFilePath() == null || report.getFilePath().isEmpty()) {
                return ResponseEntity.notFound().build();
            }
            // In a real implementation, this would return the actual file
            // For now, we return the file path
            return ResponseEntity.ok("File path: " + report.getFilePath());
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    // Scheduled Reports Endpoints
    @GetMapping("/scheduled")
    public ResponseEntity<List<ScheduledReportDto>> getAllScheduledReports(
            @RequestParam(required = false) String type
    ) {
        List<ScheduledReport> scheduledReports = service.getAllScheduledReports(type);
        List<ScheduledReportDto> dtos = scheduledReports.stream()
                .map(this::toDto)
                .collect(Collectors.toList());
        return ResponseEntity.ok(dtos);
    }

    @GetMapping("/scheduled/{id}")
    public ResponseEntity<ScheduledReportDto> getScheduledReportById(@PathVariable UUID id) {
        try {
            ScheduledReport scheduledReport = service.getScheduledReportById(id);
            return ResponseEntity.ok(toDto(scheduledReport));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping("/schedule")
    public ResponseEntity<ScheduledReportDto> scheduleReport(@RequestBody ScheduleReportRequest request) {
        try {
            ScheduledReport scheduledReport = new ScheduledReport();
            scheduledReport.setReportType(request.reportType());
            scheduledReport.setFrequency(request.frequency());
            scheduledReport.setScheduledTime(LocalTime.parse(request.scheduledTime()));
            scheduledReport.setEmailRecipients(request.emailRecipients());
            scheduledReport.setIsActive(request.isActive() != null ? request.isActive() : true);
            scheduledReport.setCreatedBy(request.createdBy());

            ScheduledReport created = service.createScheduledReport(scheduledReport);
            return ResponseEntity.status(HttpStatus.CREATED).body(toDto(created));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PutMapping("/scheduled/{id}")
    public ResponseEntity<ScheduledReportDto> updateScheduledReport(
            @PathVariable UUID id,
            @RequestBody ScheduleReportRequest request
    ) {
        try {
            ScheduledReport scheduledReport = new ScheduledReport();
            scheduledReport.setReportType(request.reportType());
            scheduledReport.setFrequency(request.frequency());
            scheduledReport.setScheduledTime(LocalTime.parse(request.scheduledTime()));
            scheduledReport.setEmailRecipients(request.emailRecipients());
            scheduledReport.setIsActive(request.isActive());

            ScheduledReport updated = service.updateScheduledReport(id, scheduledReport);
            return ResponseEntity.ok(toDto(updated));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @DeleteMapping("/scheduled/{id}")
    public ResponseEntity<Void> deleteScheduledReport(@PathVariable UUID id) {
        try {
            service.deleteScheduledReport(id);
            return ResponseEntity.noContent().build();
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    // Custom Reports
    @PostMapping("/custom")
    public ResponseEntity<ReportDto> createCustomReport(@RequestBody CreateCustomReportRequest request) {
        try {
            Report report = new Report();
            report.setReportName(request.reportName());
            report.setReportType(request.reportType());
            report.setDescription(request.description());
            report.setReportConfig(request.reportConfig()); // Custom configuration JSON
            report.setCreatedBy(request.createdBy());

            Report created = service.createReport(report);
            return ResponseEntity.status(HttpStatus.CREATED).body(toDto(created));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    // Conversion methods
    private ReportDto toDto(Report report) {
        return new ReportDto(
                report.getId(),
                report.getReportName(),
                report.getReportType(),
                report.getDescription(),
                report.getReportConfig(),
                report.getGeneratedAt(),
                report.getFileSizeBytes(),
                report.getFilePath(),
                report.getCreatedBy()
        );
    }

    private ScheduledReportDto toDto(ScheduledReport scheduledReport) {
        return new ScheduledReportDto(
                scheduledReport.getId(),
                scheduledReport.getReportType(),
                scheduledReport.getFrequency(),
                scheduledReport.getScheduledTime() != null ? scheduledReport.getScheduledTime().toString() : null,
                scheduledReport.getEmailRecipients(),
                scheduledReport.getIsActive(),
                scheduledReport.getLastGeneratedAt(),
                scheduledReport.getNextGenerationAt(),
                scheduledReport.getCreatedBy()
        );
    }

    // DTOs
    public record ReportDto(
            UUID id,
            String reportName,
            String reportType,
            String description,
            String reportConfig,
            LocalDateTime generatedAt,
            Long fileSizeBytes,
            String filePath,
            UUID createdBy
    ) {}

    public record ScheduledReportDto(
            UUID id,
            String reportType,
            String frequency,
            String scheduledTime,
            String[] emailRecipients,
            Boolean isActive,
            LocalDateTime lastGeneratedAt,
            LocalDateTime nextGenerationAt,
            UUID createdBy
    ) {}

    public record GenerateReportRequest(
            String reportName,
            String reportType,
            String description,
            String reportConfig,
            UUID createdBy
    ) {}

    public record ScheduleReportRequest(
            String reportType,
            String frequency,
            String scheduledTime, // Format: "HH:mm:ss"
            String[] emailRecipients,
            Boolean isActive,
            UUID createdBy
    ) {}

    public record CreateCustomReportRequest(
            String reportName,
            String reportType,
            String description,
            String reportConfig, // JSON string with custom configuration
            UUID createdBy
    ) {}

    public record ExportReportRequest(
            String reportType,
            String format,
            UUID createdBy
    ) {}
}
