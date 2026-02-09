package com.optiwms.infra.reports;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Repository
public interface ScheduledReportRepository extends JpaRepository<ScheduledReportEntity, UUID> {
    List<ScheduledReportEntity> findByIsActive(Boolean isActive);
    List<ScheduledReportEntity> findByReportType(String reportType);
    List<ScheduledReportEntity> findByFrequency(String frequency);
    List<ScheduledReportEntity> findByNextGenerationAtBefore(LocalDateTime dateTime);
    List<ScheduledReportEntity> findByCreatedBy(UUID createdBy);
}

