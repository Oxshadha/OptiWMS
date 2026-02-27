package com.optiwms.coreapp.reports;

import com.optiwms.domain.reports.Report;
import com.optiwms.domain.reports.ScheduledReport;
import com.optiwms.infra.anomalies.AnomalyEntity;
import com.optiwms.infra.anomalies.AnomalyRepository;
import com.optiwms.infra.cyclecount.CycleCountEntity;
import com.optiwms.infra.cyclecount.CycleCountRepository;
import com.optiwms.infra.inventory.InventoryItemEntity;
import com.optiwms.infra.inventory.InventoryItemRepository;
import com.optiwms.infra.master.MaterialEntity;
import com.optiwms.infra.master.MaterialRepository;
import com.optiwms.infra.master.WarehouseEntity;
import com.optiwms.infra.master.WarehouseRepository;
import com.optiwms.infra.orders.OrderEntity;
import com.optiwms.infra.orders.OrderRepository;
import com.optiwms.infra.reports.ReportEntity;
import com.optiwms.infra.reports.ReportRepository;
import com.optiwms.infra.reports.ScheduledReportEntity;
import com.optiwms.infra.reports.ScheduledReportRepository;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class ReportsService {

    private static final DateTimeFormatter FILE_TS_FORMAT = DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss");
    private static final DateTimeFormatter PDF_TS_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static final int EXPORT_BATCH_SIZE = 500;
    private static final int MAX_EXPORT_ROWS = 50000;

    private final ReportRepository reportRepository;
    private final ScheduledReportRepository scheduledReportRepository;
    private final InventoryItemRepository inventoryItemRepository;
    private final OrderRepository orderRepository;
    private final MaterialRepository materialRepository;
    private final WarehouseRepository warehouseRepository;
    private final CycleCountRepository cycleCountRepository;
    private final AnomalyRepository anomalyRepository;

    public ReportsService(
            ReportRepository reportRepository,
            ScheduledReportRepository scheduledReportRepository,
            InventoryItemRepository inventoryItemRepository,
            OrderRepository orderRepository,
            MaterialRepository materialRepository,
            WarehouseRepository warehouseRepository,
            CycleCountRepository cycleCountRepository,
            AnomalyRepository anomalyRepository) {
        this.reportRepository = reportRepository;
        this.scheduledReportRepository = scheduledReportRepository;
        this.inventoryItemRepository = inventoryItemRepository;
        this.orderRepository = orderRepository;
        this.materialRepository = materialRepository;
        this.warehouseRepository = warehouseRepository;
        this.cycleCountRepository = cycleCountRepository;
        this.anomalyRepository = anomalyRepository;
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

    @Transactional
    public ExportedReportFile exportReport(String reportType, String format, UUID createdBy) {
        String normalizedType = normalizeType(reportType);
        String normalizedFormat = normalizeFormat(format);
        ReportData reportData = buildReportData(normalizedType);

        byte[] fileBytes;
        String contentType;
        if ("csv".equals(normalizedFormat)) {
            fileBytes = generateCsv(reportData).getBytes(StandardCharsets.UTF_8);
            contentType = "text/csv";
        } else {
            fileBytes = generatePdf(reportData);
            contentType = "application/pdf";
        }

        String ts = LocalDateTime.now().format(FILE_TS_FORMAT);
        String fileName = normalizedType + "-report-" + ts + "." + normalizedFormat;

        ReportEntity reportEntity = new ReportEntity();
        reportEntity.setReportName(toTitle(normalizedType) + " Report");
        reportEntity.setReportType(normalizedType);
        reportEntity.setDescription("Auto-generated " + normalizedFormat.toUpperCase(Locale.ROOT) + " export");
        reportEntity.setReportConfig("{\"format\":\"" + normalizedFormat + "\",\"rowCount\":" + reportData.rows().size() + "}");
        reportEntity.setGeneratedAt(LocalDateTime.now());
        reportEntity.setFileSizeBytes((long) fileBytes.length);
        reportEntity.setFilePath(fileName);
        reportEntity.setCreatedBy(createdBy);

        ReportEntity saved = reportRepository.save(reportEntity);

        return new ExportedReportFile(
                saved.getId(),
                fileName,
                contentType,
                fileBytes,
                (long) fileBytes.length,
                normalizedType,
                normalizedFormat
        );
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

        switch (frequency.toLowerCase(Locale.ROOT)) {
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

    private String normalizeType(String type) {
        if (type == null || type.isBlank()) {
            return "inventory";
        }
        String normalized = type.trim().toLowerCase(Locale.ROOT);
        return switch (normalized) {
            case "inventory", "inbound", "outbound", "sales", "analytics", "customer", "audit" -> normalized;
            default -> throw new RuntimeException("Unsupported report type: " + type);
        };
    }

    private String normalizeFormat(String format) {
        if (format == null || format.isBlank()) {
            return "pdf";
        }
        String normalized = format.trim().toLowerCase(Locale.ROOT);
        if (!"pdf".equals(normalized) && !"csv".equals(normalized)) {
            throw new RuntimeException("Unsupported export format: " + format);
        }
        return normalized;
    }

    private ReportData buildReportData(String reportType) {
        return switch (reportType) {
            case "inventory" -> buildInventoryReport();
            case "inbound" -> buildOrderReport("inbound");
            case "outbound" -> buildOrderReport("outbound");
            case "sales" -> buildSalesReport();
            case "customer" -> buildCustomerOrderReport();
            case "audit" -> buildAuditReport();
            case "analytics" -> buildAnalyticsReport();
            default -> throw new RuntimeException("Unsupported report type: " + reportType);
        };
    }

    private ReportData buildInventoryReport() {
        List<InventoryItemEntity> items = fetchAllInBatches(
                pageable -> inventoryItemRepository.findAll(
                        PageRequest.of(pageable.getPageNumber(), pageable.getPageSize(), Sort.by(Sort.Direction.ASC, "locationCode"))
                )
        );
        Map<UUID, String> materialById = materialRepository.findAll().stream()
                .collect(Collectors.toMap(MaterialEntity::getId, MaterialEntity::getMaterialCode));
        Map<UUID, String> warehouseById = warehouseRepository.findAll().stream()
                .collect(Collectors.toMap(WarehouseEntity::getId, WarehouseEntity::getName));

        List<String> columns = List.of(
                "Material", "Warehouse", "Location", "Qty", "Available", "Reserved", "ROP", "Status"
        );
        List<List<String>> rows = items.stream().map(item -> List.of(
                safe(materialById.get(item.getMaterialId())),
                safe(warehouseById.get(item.getWarehouseId())),
                safe(item.getLocationCode()),
                String.valueOf(defaultInt(item.getQuantity())),
                String.valueOf(defaultInt(item.getAvailableQuantity())),
                String.valueOf(defaultInt(item.getReservedQuantity())),
                safeDecimal(item.getReorderPoint()),
                safe(item.getStatus())
        )).collect(Collectors.toList());

        long totalQty = items.stream().mapToLong(i -> defaultInt(i.getQuantity())).sum();
        long lowStock = items.stream().filter(i -> {
            BigDecimal rop = i.getReorderPoint();
            return rop != null && BigDecimal.valueOf(defaultInt(i.getQuantity())).compareTo(rop) <= 0;
        }).count();

        Map<String, Long> metrics = new LinkedHashMap<>();
        metrics.put("Total Inventory Records", (long) items.size());
        metrics.put("Total Quantity", totalQty);
        metrics.put("Low Stock Records", lowStock);

        return new ReportData("Inventory Snapshot Report", columns, rows, metrics);
    }

    private ReportData buildOrderReport(String type) {
        List<OrderEntity> orders = fetchAllInBatches(
                pageable -> orderRepository.findAll((root, cq, cb) -> cb.equal(cb.lower(root.get("orderType")), type.toLowerCase(Locale.ROOT)), pageable)
        );
        Map<UUID, String> warehouseById = warehouseRepository.findAll().stream()
                .collect(Collectors.toMap(WarehouseEntity::getId, WarehouseEntity::getName));

        List<String> columns = List.of(
                "Order Number", "Status", "Priority", "Order Date", "Expected Date", "Warehouse", "Total Amount"
        );
        List<List<String>> rows = orders.stream().map(order -> List.of(
                safe(order.getOrderNumber()),
                safe(order.getStatus()),
                safe(order.getPriority()),
                safe(order.getOrderDate()),
                safe(order.getExpectedDate()),
                safe(warehouseById.get(order.getWarehouseId())),
                safeDecimal(order.getTotalAmount())
        )).collect(Collectors.toList());

        Map<String, Long> metrics = new LinkedHashMap<>();
        metrics.put("Total Orders", (long) orders.size());
        metrics.put("Completed Orders", orders.stream().filter(o -> "completed".equalsIgnoreCase(o.getStatus())).count());
        metrics.put("Pending Orders", orders.stream().filter(o -> "pending".equalsIgnoreCase(o.getStatus())).count());

        String title = "inbound".equals(type) ? "Inbound Operations Report" : "Outbound Operations Report";
        return new ReportData(title, columns, rows, metrics);
    }

    private ReportData buildSalesReport() {
        List<OrderEntity> outboundOrders = fetchAllInBatches(
                pageable -> orderRepository.findAll((root, cq, cb) -> cb.equal(cb.lower(root.get("orderType")), "outbound"), pageable)
        );

        List<String> columns = List.of("Order Number", "Status", "Order Date", "Total Amount");
        List<List<String>> rows = outboundOrders.stream().map(order -> List.of(
                safe(order.getOrderNumber()),
                safe(order.getStatus()),
                safe(order.getOrderDate()),
                safeDecimal(order.getTotalAmount())
        )).collect(Collectors.toList());

        BigDecimal totalValue = outboundOrders.stream()
                .map(OrderEntity::getTotalAmount)
                .filter(v -> v != null)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        Map<String, Long> metrics = new LinkedHashMap<>();
        metrics.put("Outbound Order Count", (long) outboundOrders.size());
        metrics.put("Delivered Orders", outboundOrders.stream().filter(o -> "delivered".equalsIgnoreCase(o.getStatus())).count());
        metrics.put("Total Sales Value", totalValue.longValue());

        return new ReportData("Sales Fulfillment Report", columns, rows, metrics);
    }

    private ReportData buildCustomerOrderReport() {
        List<OrderEntity> outboundOrders = fetchAllInBatches(
                pageable -> orderRepository.findAll((root, cq, cb) -> cb.equal(cb.lower(root.get("orderType")), "outbound"), pageable)
        );

        List<String> columns = List.of("Order Number", "Customer ID", "Status", "Order Date", "Expected Date");
        List<List<String>> rows = outboundOrders.stream().map(order -> List.of(
                safe(order.getOrderNumber()),
                safe(order.getCustomerId()),
                safe(order.getStatus()),
                safe(order.getOrderDate()),
                safe(order.getExpectedDate())
        )).collect(Collectors.toList());

        Map<String, Long> metrics = new LinkedHashMap<>();
        metrics.put("Total Customer Orders", (long) outboundOrders.size());
        metrics.put("Unique Customers", outboundOrders.stream().map(OrderEntity::getCustomerId).filter(id -> id != null).distinct().count());
        metrics.put("Open Orders", outboundOrders.stream().filter(o -> !"delivered".equalsIgnoreCase(o.getStatus())).count());

        return new ReportData("Customer Service Report", columns, rows, metrics);
    }

    private ReportData buildAuditReport() {
        List<CycleCountEntity> cycleCounts = fetchAllInBatches(
                pageable -> cycleCountRepository.findAll(
                        PageRequest.of(pageable.getPageNumber(), pageable.getPageSize(), Sort.by(Sort.Direction.DESC, "createdAt"))
                )
        );
        List<AnomalyEntity> anomalies = fetchAllInBatches(
                pageable -> anomalyRepository.findAll(
                        PageRequest.of(pageable.getPageNumber(), pageable.getPageSize(), Sort.by(Sort.Direction.DESC, "createdAt"))
                )
        );

        List<String> columns = List.of("Source", "Reference", "Status", "Severity/Variance", "Created At");
        List<List<String>> rows = new ArrayList<>();

        cycleCounts.stream().limit(500).forEach(c -> rows.add(List.of(
                "Cycle Count",
                safe(c.getCountNumber()),
                safe(c.getStatus()),
                safeDecimal(c.getVariancePercentage()),
                safe(c.getCreatedAt())
        )));

        anomalies.stream().limit(500).forEach(a -> rows.add(List.of(
                "Anomaly",
                safe(a.getAnomalyType()),
                safe(a.getStatus()),
                safe(a.getSeverity()),
                safe(a.getCreatedAt())
        )));

        Map<String, Long> metrics = new LinkedHashMap<>();
        metrics.put("Cycle Count Logs", (long) cycleCounts.size());
        metrics.put("Detected Anomalies", (long) anomalies.size());
        metrics.put("Open Anomalies", anomalies.stream().filter(a -> !"RESOLVED".equalsIgnoreCase(a.getStatus())).count());

        return new ReportData("Audit and Compliance Report", columns, rows, metrics);
    }

    private ReportData buildAnalyticsReport() {
        List<InventoryItemEntity> inventoryItems = fetchAllInBatches(
                pageable -> inventoryItemRepository.findAll(PageRequest.of(pageable.getPageNumber(), pageable.getPageSize()))
        );
        List<OrderEntity> inbound = fetchAllInBatches(
                pageable -> orderRepository.findAll((root, cq, cb) -> cb.equal(cb.lower(root.get("orderType")), "inbound"), pageable)
        );
        List<OrderEntity> outbound = fetchAllInBatches(
                pageable -> orderRepository.findAll((root, cq, cb) -> cb.equal(cb.lower(root.get("orderType")), "outbound"), pageable)
        );
        List<AnomalyEntity> anomalies = fetchAllInBatches(
                pageable -> anomalyRepository.findAll(PageRequest.of(pageable.getPageNumber(), pageable.getPageSize()))
        );

        Map<String, Long> metrics = new LinkedHashMap<>();
        metrics.put("Inventory Records", (long) inventoryItems.size());
        metrics.put("Inbound Orders", (long) inbound.size());
        metrics.put("Outbound Orders", (long) outbound.size());
        metrics.put("Detected Anomalies", (long) anomalies.size());

        List<String> columns = List.of("KPI", "Value");
        List<List<String>> rows = metrics.entrySet().stream()
                .map(entry -> List.of(entry.getKey(), String.valueOf(entry.getValue())))
                .collect(Collectors.toList());

        return new ReportData("WMS Analytics Summary", columns, rows, metrics);
    }

    private String generateCsv(ReportData reportData) {
        StringBuilder csv = new StringBuilder();
        csv.append("Report").append(',').append(escapeCsv(reportData.title())).append('\n');
        csv.append("Generated At").append(',').append(escapeCsv(LocalDateTime.now().toString())).append('\n');
        csv.append('\n');

        csv.append("Metric,Value\n");
        reportData.metrics().forEach((k, v) -> csv
                .append(escapeCsv(k))
                .append(',')
                .append(v)
                .append('\n'));
        csv.append('\n');

        csv.append(String.join(",", reportData.columns().stream().map(this::escapeCsv).toList())).append('\n');
        for (List<String> row : reportData.rows()) {
            csv.append(String.join(",", row.stream().map(this::escapeCsv).toList())).append('\n');
        }

        return csv.toString();
    }

    private byte[] generatePdf(ReportData reportData) {
        try (PDDocument document = new PDDocument()) {
            PdfWriterState writer = new PdfWriterState(document);
            writer.drawHeader(reportData.title(), LocalDateTime.now().format(PDF_TS_FORMAT));
            writer.writeLine("Summary Metrics", PDType1Font.HELVETICA_BOLD, 12f, 16f);

            reportData.metrics().forEach((k, v) -> writer.writeLine("- " + k + ": " + v, PDType1Font.HELVETICA, 10f));
            writer.spacer(10f);

            writer.writeLine("KPI Chart", PDType1Font.HELVETICA_BOLD, 12f, 16f);
            writer.drawBarChart(reportData.metrics());
            writer.spacer(10f);

            writer.writeLine("Data Table", PDType1Font.HELVETICA_BOLD, 12f, 16f);
            writer.writeTableHeader(reportData.columns());

            int maxRowsInPdf = Math.min(reportData.rows().size(), 1000);
            for (int i = 0; i < maxRowsInPdf; i++) {
                writer.writeTableRow(reportData.rows().get(i));
            }

            if (reportData.rows().size() > maxRowsInPdf) {
                writer.writeLine("... " + (reportData.rows().size() - maxRowsInPdf) + " more rows (use CSV export for full data)", PDType1Font.HELVETICA_OBLIQUE, 9f);
            }

            writer.close();
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            document.save(output);
            return output.toByteArray();
        } catch (IOException e) {
            throw new RuntimeException("Failed to generate PDF report", e);
        }
    }

    private String safe(Object value) {
        return value == null ? "" : String.valueOf(value);
    }

    private int defaultInt(Integer value) {
        return value == null ? 0 : value;
    }

    private String safeDecimal(BigDecimal value) {
        if (value == null) {
            return "";
        }
        return value.stripTrailingZeros().toPlainString();
    }

    private String escapeCsv(String value) {
        if (value == null) {
            return "";
        }
        String escaped = value.replace("\"", "\"\"");
        if (escaped.contains(",") || escaped.contains("\n") || escaped.contains("\r") || escaped.contains("\"")) {
            return "\"" + escaped + "\"";
        }
        return escaped;
    }

    private <T> List<T> fetchAllInBatches(Function<Pageable, Page<T>> pageFetcher) {
        List<T> all = new ArrayList<>();
        int pageNumber = 0;
        while (all.size() < MAX_EXPORT_ROWS) {
            Page<T> page = pageFetcher.apply(PageRequest.of(pageNumber, EXPORT_BATCH_SIZE));
            if (page.isEmpty()) {
                break;
            }
            for (T row : page.getContent()) {
                all.add(row);
                if (all.size() >= MAX_EXPORT_ROWS) {
                    break;
                }
            }
            if (!page.hasNext()) {
                break;
            }
            pageNumber++;
        }
        return all;
    }

    private String toTitle(String value) {
        if (value == null || value.isBlank()) {
            return "Report";
        }
        return Character.toUpperCase(value.charAt(0)) + value.substring(1).toLowerCase(Locale.ROOT);
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

    public record ExportedReportFile(
            UUID reportId,
            String fileName,
            String contentType,
            byte[] content,
            Long fileSizeBytes,
            String reportType,
            String format
    ) {}

    private record ReportData(
            String title,
            List<String> columns,
            List<List<String>> rows,
            Map<String, Long> metrics
    ) {}

    private static class PdfWriterState {
        private static final float LEFT = 40f;
        private static final float RIGHT = 555f;
        private static final float TOP = 806f;
        private static final float BOTTOM = 45f;
        private static final float TABLE_ROW_HEIGHT = 17f;
        private static final float[] TABLE_COL_WIDTHS = new float[] {80f, 140f, 90f, 60f, 70f, 70f, 60f, 50f};

        private final PDDocument document;
        private PDPage page;
        private PDPageContentStream contentStream;
        private float cursorY;
        private int tableColumnCount;

        private PdfWriterState(PDDocument document) throws IOException {
            this.document = document;
            this.page = new PDPage(PDRectangle.A4);
            this.document.addPage(page);
            this.contentStream = new PDPageContentStream(document, page);
            this.cursorY = TOP;
            this.tableColumnCount = 0;
        }

        private void writeLine(String text, PDType1Font font, float fontSize) {
            writeLine(text, font, fontSize, 14f);
        }

        private void writeLine(String text, PDType1Font font, float fontSize, float rowHeight) {
            try {
                ensureRoom(rowHeight + 4f);
                contentStream.setNonStrokingColor(34, 40, 49);
                contentStream.beginText();
                contentStream.setFont(font, fontSize);
                contentStream.newLineAtOffset(LEFT, cursorY);
                contentStream.showText(text == null ? "" : text);
                contentStream.endText();
                cursorY -= rowHeight;
            } catch (IOException e) {
                throw new RuntimeException("Failed to write PDF content", e);
            }
        }

        private void spacer(float amount) {
            cursorY -= amount;
        }

        private void drawHeader(String title, String generatedAt) {
            try {
                ensureRoom(130f);
                float logoRightX = drawLogoIfExists();

                contentStream.setNonStrokingColor(34, 40, 49);
                contentStream.beginText();
                contentStream.setFont(PDType1Font.HELVETICA_BOLD, 23f);
                contentStream.newLineAtOffset(logoRightX + 24f, TOP - 18f);
                contentStream.showText("OptiWMS");
                contentStream.endText();

                contentStream.beginText();
                contentStream.setFont(PDType1Font.HELVETICA_BOLD, 16f);
                contentStream.newLineAtOffset(logoRightX + 24f, TOP - 43f);
                contentStream.showText(title);
                contentStream.endText();

                contentStream.beginText();
                contentStream.setFont(PDType1Font.HELVETICA, 10.5f);
                contentStream.newLineAtOffset(logoRightX + 24f, TOP - 64f);
                contentStream.showText("Generated At: " + generatedAt);
                contentStream.endText();

                contentStream.setStrokingColor(226, 232, 240);
                contentStream.moveTo(LEFT, TOP - 86f);
                contentStream.lineTo(RIGHT, TOP - 86f);
                contentStream.stroke();

                cursorY = TOP - 104f;
            } catch (IOException e) {
                throw new RuntimeException("Failed to draw PDF header", e);
            }
        }

        private void drawBarChart(Map<String, Long> metrics) {
            if (metrics.isEmpty()) {
                return;
            }
            try {
                float required = (metrics.size() * 28f) + 24f;
                ensureRoom(required);
                long max = metrics.values().stream().mapToLong(Long::longValue).max().orElse(1);
                float x = LEFT;
                float y = cursorY;
                float barHeight = 12f;
                float maxWidth = 250f;
                float barX = x + 170f;

                for (Map.Entry<String, Long> entry : metrics.entrySet()) {
                    float width = max == 0
                            ? 0f
                            : ((float) Math.log10(entry.getValue() + 1d) / (float) Math.log10(max + 1d)) * maxWidth;

                    contentStream.setNonStrokingColor(34, 40, 49);
                    contentStream.beginText();
                    contentStream.setFont(PDType1Font.HELVETICA, 9f);
                    contentStream.newLineAtOffset(x, y);
                    contentStream.showText(entry.getKey());
                    contentStream.endText();

                    contentStream.setNonStrokingColor(241, 245, 249);
                    contentStream.addRect(barX, y - 9f, maxWidth, barHeight);
                    contentStream.fill();

                    contentStream.setNonStrokingColor(209, 6, 84);
                    contentStream.addRect(barX, y - 9f, width, barHeight);
                    contentStream.fill();

                    contentStream.setNonStrokingColor(34, 40, 49);
                    contentStream.beginText();
                    contentStream.setFont(PDType1Font.HELVETICA_BOLD, 9f);
                    contentStream.newLineAtOffset(barX + maxWidth + 8f, y - 6f);
                    contentStream.showText(String.valueOf(entry.getValue()));
                    contentStream.endText();

                    y -= 28f;
                }

                cursorY = y - 4f;
            } catch (IOException e) {
                throw new RuntimeException("Failed to draw PDF chart", e);
            }
        }

        private void writeTableHeader(List<String> columns) {
            this.tableColumnCount = columns.size();
            writeTableRowInternal(columns, true);
        }

        private void writeTableRow(List<String> row) {
            writeTableRowInternal(row, false);
        }

        private void writeTableRowInternal(List<String> row, boolean header) {
            try {
                ensureRoom(TABLE_ROW_HEIGHT + 4f);
                float x = LEFT;
                float yTop = cursorY + 5f;
                float yBottom = cursorY - TABLE_ROW_HEIGHT + 5f;

                if (header) {
                    contentStream.setNonStrokingColor(248, 250, 252);
                    contentStream.addRect(LEFT, yBottom, RIGHT - LEFT, TABLE_ROW_HEIGHT);
                    contentStream.fill();
                }

                contentStream.setStrokingColor(226, 232, 240);
                contentStream.moveTo(LEFT, yBottom);
                contentStream.lineTo(RIGHT, yBottom);
                contentStream.stroke();

                int colCount = tableColumnCount > 0 ? tableColumnCount : row.size();
                for (int i = 0; i < colCount; i++) {
                    float width = i < TABLE_COL_WIDTHS.length ? TABLE_COL_WIDTHS[i] : 60f;
                    String value = i < row.size() ? row.get(i) : "";
                    String text = truncate(value, (int) Math.max(8, width / 4.7f));

                    contentStream.setNonStrokingColor(34, 40, 49);
                    contentStream.beginText();
                    contentStream.setFont(header ? PDType1Font.HELVETICA_BOLD : PDType1Font.HELVETICA, 8.5f);
                    contentStream.newLineAtOffset(x + 3f, cursorY - 7f);
                    contentStream.showText(text);
                    contentStream.endText();

                    contentStream.setStrokingColor(241, 245, 249);
                    contentStream.moveTo(x + width, yTop);
                    contentStream.lineTo(x + width, yBottom);
                    contentStream.stroke();

                    x += width;
                    if (x >= RIGHT) {
                        break;
                    }
                }

                cursorY -= TABLE_ROW_HEIGHT;
            } catch (IOException e) {
                throw new RuntimeException("Failed to draw PDF table row", e);
            }
        }

        private String truncate(String value, int maxLen) {
            String text = value == null ? "" : value;
            if (text.length() <= maxLen) {
                return text;
            }
            return text.substring(0, Math.max(1, maxLen - 3)) + "...";
        }

        private float drawLogoIfExists() {
            float defaultRight = LEFT + 220f;
            try {
                String cwd = System.getProperty("user.dir");
                String[] candidates = new String[] {
                        "frontend/public/assets/logos/logo with tagline.png",
                        "../frontend/public/assets/logos/logo with tagline.png",
                        "../../frontend/public/assets/logos/logo with tagline.png"
                };
                for (String candidate : candidates) {
                    try {
                        Path resolved = Paths.get(cwd).resolve(candidate).normalize();
                        PDImageXObject logo = PDImageXObject.createFromFileByContent(resolved.toFile(), document);
                        float boxW = 220f;
                        float boxH = 72f;
                        float imgW = logo.getWidth();
                        float imgH = logo.getHeight();
                        float scale = Math.min(boxW / imgW, boxH / imgH);
                        float drawW = imgW * scale;
                        float drawH = imgH * scale;
                        float drawX = LEFT + ((boxW - drawW) / 2f);
                        float drawY = (TOP - 74f) + ((boxH - drawH) / 2f);
                        contentStream.drawImage(logo, drawX, drawY, drawW, drawH);
                        return LEFT + boxW;
                    } catch (IOException ignored) {
                        // Try next candidate path.
                    }
                }
            } catch (Exception ignored) {
                // Logo is optional.
            }
            return defaultRight;
        }

        private void ensureRoom(float requiredHeight) throws IOException {
            if (cursorY - requiredHeight > BOTTOM) {
                return;
            }
            contentStream.close();
            page = new PDPage(PDRectangle.A4);
            document.addPage(page);
            contentStream = new PDPageContentStream(document, page);
            cursorY = TOP;
        }

        private void close() throws IOException {
            contentStream.close();
        }
    }
}
