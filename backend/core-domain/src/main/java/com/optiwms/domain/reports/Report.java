package com.optiwms.domain.reports;

import com.optiwms.domain.common.BaseEntity;

import java.time.LocalDateTime;
import java.util.UUID;

public class Report extends BaseEntity {
    private String reportName;
    private String reportType; // inbound, outbound, inventory, sales, analytics, customer
    private String description;
    private String reportConfig; // JSON string
    private LocalDateTime generatedAt;
    private Long fileSizeBytes;
    private String filePath;
    private UUID createdBy;

    // Getters and Setters
    public String getReportName() {
        return reportName;
    }

    public void setReportName(String reportName) {
        this.reportName = reportName;
    }

    public String getReportType() {
        return reportType;
    }

    public void setReportType(String reportType) {
        this.reportType = reportType;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getReportConfig() {
        return reportConfig;
    }

    public void setReportConfig(String reportConfig) {
        this.reportConfig = reportConfig;
    }

    public LocalDateTime getGeneratedAt() {
        return generatedAt;
    }

    public void setGeneratedAt(LocalDateTime generatedAt) {
        this.generatedAt = generatedAt;
    }

    public Long getFileSizeBytes() {
        return fileSizeBytes;
    }

    public void setFileSizeBytes(Long fileSizeBytes) {
        this.fileSizeBytes = fileSizeBytes;
    }

    public String getFilePath() {
        return filePath;
    }

    public void setFilePath(String filePath) {
        this.filePath = filePath;
    }

    public UUID getCreatedBy() {
        return createdBy;
    }

    public void setCreatedBy(UUID createdBy) {
        this.createdBy = createdBy;
    }
}

