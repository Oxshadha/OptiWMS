package com.optiwms.coreapi.reports;

import com.optiwms.coreapp.reports.ReportService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/reports")
public class ReportController {

    private final ReportService service;

    public ReportController(ReportService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> list() {
        return ResponseEntity.ok(service.listAll());
    }

    @GetMapping("/{id}")
    public ResponseEntity<Map<String, Object>> getById(@PathVariable java.util.UUID id) {
        try {
            return ResponseEntity.ok(service.findById(id));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping("/generate")
    public ResponseEntity<Map<String, Object>> generate(@RequestBody GenerateReportRequest request) {
        try {
            var report = service.generate(request.reportType(), request.parameters());
            return ResponseEntity.ok(report);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PostMapping("/schedule")
    public ResponseEntity<Map<String, Object>> schedule(@RequestBody ScheduleReportRequest request) {
        try {
            var scheduled = service.schedule(request.reportType(), request.schedule(), request.parameters());
            return ResponseEntity.ok(scheduled);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @GetMapping("/{id}/download")
    public ResponseEntity<byte[]> download(@PathVariable java.util.UUID id) {
        try {
            byte[] content = service.download(id);
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_PDF);
            headers.setContentDispositionFormData("attachment", "report-" + id + ".pdf");
            return ResponseEntity.ok()
                    .headers(headers)
                    .body(content);
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    public record GenerateReportRequest(
            String reportType,
            Map<String, Object> parameters
    ) {}

    public record ScheduleReportRequest(
            String reportType,
            String schedule,
            Map<String, Object> parameters
    ) {}
}

