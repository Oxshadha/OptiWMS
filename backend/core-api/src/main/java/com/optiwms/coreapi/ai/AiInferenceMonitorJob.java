package com.optiwms.coreapi.ai;

import com.optiwms.coreapi.ai.dto.AiInferenceAlertsResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class AiInferenceMonitorJob {
    private static final Logger log = LoggerFactory.getLogger(AiInferenceMonitorJob.class);

    private final AiProxyService aiProxyService;

    @Value("${ai.monitoring.enabled:false}")
    private boolean monitoringEnabled;

    @Value("${ai.monitoring.limit:200}")
    private int monitoringWindowSize;

    @Value("${ai.monitoring.dataset:B}")
    private String monitoringDataset;

    @Value("${ai.monitoring.model:CATBOOST}")
    private String monitoringModel;

    @Value("${ai.monitoring.soak-hours:24}")
    private int monitoringSoakHours;

    public AiInferenceMonitorJob(AiProxyService aiProxyService) {
        this.aiProxyService = aiProxyService;
    }

    @Scheduled(fixedDelayString = "${ai.monitoring.fixed-delay-ms:300000}")
    public void checkInferenceHealth() {
        if (!monitoringEnabled) {
            return;
        }

        try {
            aiProxyService.refreshOperationalHealth();

            ResponseEntity<AiInferenceAlertsResponse> response = aiProxyService.getInferenceAlerts(
                    monitoringWindowSize,
                    monitoringDataset,
                    monitoringModel
            );
            AiInferenceAlertsResponse body = response.getBody();
            if (body == null) {
                log.warn("ai_monitor empty response from inference alerts endpoint");
                return;
            }

            String status = body.status() == null ? "unknown" : body.status().toLowerCase();
            String summary = String.format(
                    "status=%s count=%s fallback_rate=%s total_errors=%s p95_latency_ms=%s",
                    body.status(),
                    body.summary() != null ? body.summary().count() : null,
                    body.summary() != null ? body.summary().fallbackRate() : null,
                    body.summary() != null ? body.summary().totalErrors() : null,
                    body.summary() != null ? body.summary().p95LatencyMs() : null
            );

            if ("critical".equals(status)) {
                log.error("ai_monitor critical {}", summary);
            } else if ("warn".equals(status)) {
                log.warn("ai_monitor warn {}", summary);
            } else {
                log.info("ai_monitor ok {}", summary);
            }

            ResponseEntity<Object> readiness = aiProxyService.getProductionReadiness(
                    monitoringDataset,
                    monitoringModel,
                    "test",
                    monitoringWindowSize,
                    monitoringSoakHours
            );
            log.info("ai_monitor readiness status={} body={}", readiness.getStatusCode().value(), readiness.getBody());
        } catch (Exception ex) {
            log.error("ai_monitor check failed: {}", ex.getMessage(), ex);
        }
    }
}
