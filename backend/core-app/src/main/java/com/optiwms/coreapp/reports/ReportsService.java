package com.optiwms.coreapp.reports;

import com.optiwms.domain.reports.Report;
import com.optiwms.domain.reports.ScheduledReport;
import com.optiwms.infra.reports.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class ReportsService {

    private final ReportRepository reportRepository;
    private final ScheduledReportRepository scheduledReportRepository;

    public ReportsService(
            ReportRepository reportRepository,
            ScheduledReportRepository scheduledReportRepository) {
        this.reportRepository = reportRepository;
        this.scheduledReportRepository = scheduledReportRepository;
    }

    // Reports
    public List<Report> getAllReports(String type, String status) {
        if (type != null) {
            return reportRepository.findByReportType(type).stream()
                    .map(this::toDomain)
                    .collect(Collectors.toList());
        }
        return reportRepository.findAll().stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    public Report getReportById(UUID id) {
        return reportRepository.findById(id)
                .map(this::toDomain)
                .orElseThrow(() -> new RuntimeException("Report not found: " + id));
    }

    public List<Report> getReportsByCreatedBy(UUID createdBy) {
        return reportRepository.findByCreatedBy(createdBy).stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    @Transactional
    public Report createReport(Report report) {
        ReportEntity entity = new ReportEntity();
        entity.setReportName(report.getReportName());
        entity.setReportType(report.getReportType());
        entity.setDescription(report.getDescription());
        entity.setReportConfig(report.getReportConfig());
        entity.setGeneratedAt(report.getGeneratedAt() != null ? report.getGeneratedAt() : LocalDateTime.now());
        entity.setFileSizeBytes(report.getFileSizeBytes());
        entity.setFilePath(report.getFilePath());
        entity.setCreatedBy(report.getCreatedBy());

        ReportEntity saved = reportRepository.save(entity);
        return toDomain(saved);
    }

    @Transactional
    public Report updateReport(UUID id, Report report) {
        ReportEntity entity = reportRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Report not found: " + id));

        entity.setReportName(report.getReportName());
        entity.setDescription(report.getDescription());
        entity.setReportConfig(report.getReportConfig());
        entity.setFileSizeBytes(report.getFileSizeBytes());
        entity.setFilePath(report.getFilePath());

        ReportEntity saved = reportRepository.save(entity);
        return toDomain(saved);
    }

    // Scheduled Reports
    public List<ScheduledReport> getAllScheduledReports(String type) {
        if (type != null) {
            return scheduledReportRepository.findByReportType(type).stream()
                    .map(this::toDomain)
                    .collect(Collectors.toList());
        }
        return scheduledReportRepository.findAll().stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    public List<ScheduledReport> getActiveScheduledReports() {
        return scheduledReportRepository.findByIsActive(true).stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    public ScheduledReport getScheduledReportById(UUID id) {
        return scheduledReportRepository.findById(id)
                .map(this::toDomain)
                .orElseThrow(() -> new RuntimeException("Scheduled report not found: " + id));
    }

    @Transactional
    public ScheduledReport createScheduledReport(ScheduledReport scheduledReport) {
        ScheduledReportEntity entity = new ScheduledReportEntity();
        entity.setReportType(scheduledReport.getReportType());
        entity.setFrequency(scheduledReport.getFrequency());
        entity.setScheduledTime(scheduledReport.getScheduledTime());
        entity.setEmailRecipients(scheduledReport.getEmailRecipients());
        entity.setIsActive(scheduledReport.getIsActive() != null ? scheduledReport.getIsActive() : true);
        entity.setCreatedBy(scheduledReport.getCreatedBy());
        // Calculate next generation time based on frequency
        entity.setNextGenerationAt(calculateNextGenerationTime(
                scheduledReport.getFrequency(),
                scheduledReport.getScheduledTime()
        ));

        ScheduledReportEntity saved = scheduledReportRepository.save(entity);
        return toDomain(saved);
    }

    @Transactional
    public ScheduledReport updateScheduledReport(UUID id, ScheduledReport scheduledReport) {
        ScheduledReportEntity entity = scheduledReportRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Scheduled report not found: " + id));

        entity.setReportType(scheduledReport.getReportType());
        entity.setFrequency(scheduledReport.getFrequency());
        entity.setScheduledTime(scheduledReport.getScheduledTime());
        entity.setEmailRecipients(scheduledReport.getEmailRecipients());
        entity.setIsActive(scheduledReport.getIsActive());
        entity.setNextGenerationAt(calculateNextGenerationTime(
                scheduledReport.getFrequency(),
                scheduledReport.getScheduledTime()
        ));

        ScheduledReportEntity saved = scheduledReportRepository.save(entity);
        return toDomain(saved);
    }

    @Transactional
    public void deleteScheduledReport(UUID id) {
        if (!scheduledReportRepository.existsById(id)) {
            throw new RuntimeException("Scheduled report not found: " + id);
        }
        scheduledReportRepository.deleteById(id);
    }

    private LocalDateTime calculateNextGenerationTime(String frequency, LocalTime scheduledTime) {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime next = now.with(scheduledTime);

        switch (frequency.toLowerCase()) {
            case "daily":
                if (next.isBefore(now)) {
                    next = next.plusDays(1);
                }
                break;
            case "weekly":
                next = next.plusWeeks(1);
                if (next.isBefore(now)) {
                    next = next.plusWeeks(1);
                }
                break;
            case "monthly":
                next = next.plusMonths(1);
                if (next.isBefore(now)) {
                    next = next.plusMonths(1);
                }
                break;
            default:
                next = now.plusDays(1);
        }
        return next;
    }

    // Conversion methods
    private Report toDomain(ReportEntity entity) {
        Report report = new Report();
        report.setId(entity.getId());
        report.setReportName(entity.getReportName());
        report.setReportType(entity.getReportType());
        report.setDescription(entity.getDescription());
        report.setReportConfig(entity.getReportConfig());
        report.setGeneratedAt(entity.getGeneratedAt());
        report.setFileSizeBytes(entity.getFileSizeBytes());
        report.setFilePath(entity.getFilePath());
        report.setCreatedBy(entity.getCreatedBy());
        return report;
    }

    private ScheduledReport toDomain(ScheduledReportEntity entity) {
        ScheduledReport scheduledReport = new ScheduledReport();
        scheduledReport.setId(entity.getId());
        scheduledReport.setReportType(entity.getReportType());
        scheduledReport.setFrequency(entity.getFrequency());
        scheduledReport.setScheduledTime(entity.getScheduledTime());
        scheduledReport.setEmailRecipients(entity.getEmailRecipients());
        scheduledReport.setIsActive(entity.getIsActive());
        scheduledReport.setLastGeneratedAt(entity.getLastGeneratedAt());
        scheduledReport.setNextGenerationAt(entity.getNextGenerationAt());
        scheduledReport.setCreatedBy(entity.getCreatedBy());
        return scheduledReport;
    }
}

