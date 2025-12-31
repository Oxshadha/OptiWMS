package com.optiwms.infra.reports;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Repository
public interface ReportRepository extends JpaRepository<ReportEntity, UUID> {
    List<ReportEntity> findByReportType(String reportType);
    List<ReportEntity> findByCreatedBy(UUID createdBy);
    List<ReportEntity> findByGeneratedAtBetween(LocalDateTime start, LocalDateTime end);
    List<ReportEntity> findByReportTypeAndCreatedBy(String reportType, UUID createdBy);
}

