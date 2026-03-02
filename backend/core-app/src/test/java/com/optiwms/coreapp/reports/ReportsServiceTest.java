package com.optiwms.coreapp.reports;

import com.optiwms.infra.anomalies.AnomalyRepository;
import com.optiwms.infra.cyclecount.CycleCountRepository;
import com.optiwms.infra.inventory.InventoryItemRepository;
import com.optiwms.infra.master.MaterialRepository;
import com.optiwms.infra.master.WarehouseRepository;
import com.optiwms.infra.orders.OrderRepository;
import com.optiwms.infra.reports.ReportEntity;
import com.optiwms.infra.reports.ReportRepository;
import com.optiwms.infra.reports.ScheduledReportRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ReportsServiceTest {

    private ReportRepository reportRepository;
    private ScheduledReportRepository scheduledReportRepository;
    private InventoryItemRepository inventoryItemRepository;
    private OrderRepository orderRepository;
    private MaterialRepository materialRepository;
    private WarehouseRepository warehouseRepository;
    private CycleCountRepository cycleCountRepository;
    private AnomalyRepository anomalyRepository;
    private ReportsService service;

    @BeforeEach
    void setUp() {
        reportRepository = mock(ReportRepository.class);
        scheduledReportRepository = mock(ScheduledReportRepository.class);
        inventoryItemRepository = mock(InventoryItemRepository.class);
        orderRepository = mock(OrderRepository.class);
        materialRepository = mock(MaterialRepository.class);
        warehouseRepository = mock(WarehouseRepository.class);
        cycleCountRepository = mock(CycleCountRepository.class);
        anomalyRepository = mock(AnomalyRepository.class);

        Page emptyPage = new PageImpl<>(List.of());

        when(inventoryItemRepository.findAll(any(Pageable.class))).thenReturn(emptyPage);
        when(orderRepository.findAll(any(org.springframework.data.jpa.domain.Specification.class), any(Pageable.class))).thenReturn(emptyPage);
        when(anomalyRepository.findAll(any(Pageable.class))).thenReturn(emptyPage);
        when(cycleCountRepository.findAll(any(Pageable.class))).thenReturn(emptyPage);
        when(materialRepository.findAll()).thenReturn(List.of());
        when(warehouseRepository.findAll()).thenReturn(List.of());

        service = new ReportsService(
                reportRepository,
                scheduledReportRepository,
                inventoryItemRepository,
                orderRepository,
                materialRepository,
                warehouseRepository,
                cycleCountRepository,
                anomalyRepository
        );
    }

    @Test
    void generateReportRecordCreatesExportedReportMetadata() {
        UUID reportId = UUID.randomUUID();
        when(reportRepository.save(any(ReportEntity.class))).thenAnswer(invocation -> {
            ReportEntity entity = invocation.getArgument(0);
            entity.setId(reportId);
            return entity;
        });

        ReportsService.ExportedReportFile generated = service.generateReportRecord(
                "Inventory Snapshot",
                "inventory",
                "Generated for verification",
                null,
                null
        );

        assertEquals(reportId, generated.reportId());
        assertEquals("inventory", generated.reportType());
        assertEquals("pdf", generated.format());
        assertEquals("application/pdf", generated.contentType());
        assertNotNull(generated.content());
        assertTrue(generated.content().length > 0);
        assertTrue(generated.fileName().startsWith("inventory-report-"));
    }

    @Test
    void downloadExistingReportRebuildsCsvForStoredReport() {
        UUID reportId = UUID.randomUUID();
        ReportEntity existing = new ReportEntity();
        existing.setId(reportId);
        existing.setReportName("Inventory Snapshot");
        existing.setReportType("inventory");
        existing.setDescription("CSV report");
        existing.setReportConfig("{\"format\":\"csv\"}");
        existing.setGeneratedAt(LocalDateTime.now());
        existing.setFilePath("inventory-report-test.csv");

        when(reportRepository.findById(reportId)).thenReturn(Optional.of(existing));

        ReportsService.ExportedReportFile downloaded = service.downloadExistingReport(reportId);

        assertEquals(reportId, downloaded.reportId());
        assertEquals("inventory", downloaded.reportType());
        assertEquals("csv", downloaded.format());
        assertEquals("text/csv", downloaded.contentType());
        assertEquals("inventory-report-test.csv", downloaded.fileName());
        assertNotNull(downloaded.content());
        assertTrue(downloaded.content().length > 0);
        assertTrue(new String(downloaded.content()).contains("Inventory Snapshot Report"));
    }
}
