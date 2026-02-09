package com.optiwms.domain.reports;

import com.optiwms.domain.common.BaseEntity;

import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.UUID;

public class ScheduledReport extends BaseEntity {
    private String reportType;
    private String frequency; // daily, weekly, monthly
    private LocalTime scheduledTime;
    private String[] emailRecipients;
    private Boolean isActive;
    private LocalDateTime lastGeneratedAt;
    private LocalDateTime nextGenerationAt;
    private UUID createdBy;

    // Getters and Setters
    public String getReportType() {
        return reportType;
    }

    public void setReportType(String reportType) {
        this.reportType = reportType;
    }

    public String getFrequency() {
        return frequency;
    }

    public void setFrequency(String frequency) {
        this.frequency = frequency;
    }

    public LocalTime getScheduledTime() {
        return scheduledTime;
    }

    public void setScheduledTime(LocalTime scheduledTime) {
        this.scheduledTime = scheduledTime;
    }

    public String[] getEmailRecipients() {
        return emailRecipients;
    }

    public void setEmailRecipients(String[] emailRecipients) {
        this.emailRecipients = emailRecipients;
    }

    public Boolean getIsActive() {
        return isActive;
    }

    public void setIsActive(Boolean isActive) {
        this.isActive = isActive;
    }

    public LocalDateTime getLastGeneratedAt() {
        return lastGeneratedAt;
    }

    public void setLastGeneratedAt(LocalDateTime lastGeneratedAt) {
        this.lastGeneratedAt = lastGeneratedAt;
    }

    public LocalDateTime getNextGenerationAt() {
        return nextGenerationAt;
    }

    public void setNextGenerationAt(LocalDateTime nextGenerationAt) {
        this.nextGenerationAt = nextGenerationAt;
    }

    public UUID getCreatedBy() {
        return createdBy;
    }

    public void setCreatedBy(UUID createdBy) {
        this.createdBy = createdBy;
    }
}

