package com.optiwms.coreapi.ai.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

public record AiInferenceAlertsResponse(
        String status,
        Summary summary,
        @JsonProperty("rules_triggered") List<RuleTriggered> rulesTriggered,
        @JsonProperty("window_size") Integer windowSize,
        String dataset,
        @JsonProperty("model_name") String modelName
) {
    public record Summary(
            Integer count,
            @JsonProperty("fallback_rate") Double fallbackRate,
            @JsonProperty("total_errors") Integer totalErrors,
            @JsonProperty("avg_latency_ms") Double avgLatencyMs,
            @JsonProperty("p95_latency_ms") Double p95LatencyMs
    ) {}

    public record RuleTriggered(
            String rule,
            String status,
            Double threshold,
            Double value,
            String message
    ) {}
}

