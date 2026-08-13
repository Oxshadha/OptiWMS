package com.optiwms.coreapi.ai;

import org.springframework.core.task.TaskExecutor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@Service
public class ForecastJobService {
    private final JdbcTemplate jdbcTemplate;
    private final TaskExecutor taskExecutor;
    private final AiProxyService aiProxyService;

    public ForecastJobService(JdbcTemplate jdbcTemplate, TaskExecutor taskExecutor, AiProxyService aiProxyService) {
        this.jdbcTemplate = jdbcTemplate;
        this.taskExecutor = taskExecutor;
        this.aiProxyService = aiProxyService;
    }

    public ResponseEntity<Object> queue(Authentication authentication, String dataset, String modelName,
            String mode, String warehouseId, boolean criticalOverride) {
        UUID jobId = UUID.randomUUID();
        UUID runId = UUID.randomUUID();
        UUID warehouseUuid = parseUuid(warehouseId);
        jdbcTemplate.update("""
                INSERT INTO forecast_jobs(id, run_id, warehouse_id, dataset, requested_model,
                    status, stage, progress_pct, message, requested_by)
                VALUES (?, ?, ?, ?, ?, 'queued', 'queued', 0, 'Forecast run queued', ?)
                """, jobId, runId, warehouseUuid, dataset, modelName, authentication.getName());
        taskExecutor.execute(() -> execute(jobId, authentication, dataset, modelName, mode, warehouseId, criticalOverride));
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(job(jobId));
    }

    public ResponseEntity<Object> get(UUID jobId) {
        Map<String, Object> job = job(jobId);
        return job.isEmpty() ? ResponseEntity.notFound().build() : ResponseEntity.ok(job);
    }

    private void execute(UUID jobId, Authentication authentication, String dataset, String modelName,
            String mode, String warehouseId, boolean criticalOverride) {
        update(jobId, "running", "inference_publish", 10, "Forecast service accepted the background request", false);
        try {
            ResponseEntity<Object> response = aiProxyService.triggerForecastRunWithGuard(
                    authentication, dataset, modelName, mode, warehouseId, criticalOverride);
            if (response.getStatusCode().is2xxSuccessful()) {
                update(jobId, "succeeded", "published", 100, "Forecast service completed; reload canonical PostgreSQL rows", true);
            } else {
                update(jobId, "failed", "failed", 100,
                        "Forecast service returned HTTP " + response.getStatusCode().value(), true);
            }
        } catch (Exception exception) {
            update(jobId, "failed", "failed", 100, "Forecast service failed: " + exception.getMessage(), true);
        }
    }

    private void update(UUID id, String status, String stage, int progress, String message, boolean finished) {
        jdbcTemplate.update("""
                UPDATE forecast_jobs SET status=?, stage=?, progress_pct=?, message=?,
                    started_at=COALESCE(started_at, now()), finished_at=CASE WHEN ? THEN now() ELSE finished_at END
                WHERE id=?
                """, status, stage, progress, message, finished, id);
    }

    private Map<String, Object> job(UUID id) {
        return jdbcTemplate.query("""
                SELECT id::text, run_id::text, status, stage, progress_pct, message,
                       requested_model, dataset, created_at, started_at, finished_at
                FROM forecast_jobs WHERE id=?
                """, rs -> {
            if (!rs.next()) return Map.of();
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("jobId", rs.getString(1)); row.put("runId", rs.getString(2));
            row.put("status", rs.getString(3)); row.put("stage", rs.getString(4));
            row.put("progress", rs.getInt(5)); row.put("message", rs.getString(6));
            row.put("model", rs.getString(7)); row.put("dataset", rs.getString(8));
            row.put("createdAt", rs.getObject(9)); row.put("startedAt", rs.getObject(10)); row.put("finishedAt", rs.getObject(11));
            return row;
        }, id);
    }

    private static UUID parseUuid(String value) {
        try { return value == null || value.isBlank() ? null : UUID.fromString(value); }
        catch (IllegalArgumentException ignored) { return null; }
    }
}
