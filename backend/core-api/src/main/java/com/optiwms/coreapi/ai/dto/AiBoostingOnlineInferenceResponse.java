package com.optiwms.coreapi.ai.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;
import java.util.Map;

public record AiBoostingOnlineInferenceResponse(
        String dataset,
        @JsonProperty("model_name") String modelName,
        Integer horizon,
        String stage,
        Integer count,
        List<Item> items,
        List<ErrorItem> errors,
        @JsonProperty("fallback_used") Boolean fallbackUsed,
        @JsonProperty("fallback_reason") String fallbackReason,
        @JsonProperty("fallback_count") Integer fallbackCount,
        Map<String, Object> metadata
) {
    public record Item(
            @JsonProperty("series_id") String seriesId,
            @JsonProperty("fg_code") String fgCode,
            @JsonProperty("fg_category") String fgCategory,
            Double prediction,
            Integer horizon,
            @JsonProperty("fallback_used") Boolean fallbackUsed,
            @JsonProperty("fallback_reason") String fallbackReason,
            @JsonProperty("baseline_method") String baselineMethod
    ) {}

    public record ErrorItem(
            @JsonProperty("series_id") String seriesId,
            String error
    ) {}
}
