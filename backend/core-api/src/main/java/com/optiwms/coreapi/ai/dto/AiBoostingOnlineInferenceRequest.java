package com.optiwms.coreapi.ai.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.List;
import java.util.Map;

public record AiBoostingOnlineInferenceRequest(
        @NotBlank String dataset,
        @JsonProperty("model_name") String modelName,
        @NotNull @Min(1) @Max(12) Integer horizon,
        String stage,
        @JsonProperty("clip_negative") Boolean clipNegative,
        @NotEmpty List<@Valid SeriesPayload> series
) {
    public record SeriesPayload(
            @NotBlank @JsonProperty("series_id") String seriesId,
            @NotBlank @JsonProperty("fg_code") String fgCode,
            @JsonProperty("fg_category") String fgCategory,
            @NotEmpty List<@Valid HistoryPoint> history,
            @JsonProperty("static_features") Map<String, Object> staticFeatures
    ) {}

    public record HistoryPoint(
            @NotBlank String month,
            @NotNull @Min(0) @JsonProperty("demand_units") Double demandUnits,
            @JsonProperty("on_hand_inventory") Double onHandInventory,
            @JsonProperty("stockout_days") Double stockoutDays,
            @JsonProperty("promotion_flag") Double promotionFlag,
            @JsonProperty("price_or_discount") Double priceOrDiscount,
            @JsonProperty("lead_time_days") Double leadTimeDays,
            @JsonProperty("supplier_otif") Double supplierOtif,
            @JsonProperty("inbound_po_qty") Double inboundPoQty,
            @JsonProperty("open_sales_orders") Double openSalesOrders,
            @JsonProperty("returns_qty") Double returnsQty,
            @JsonProperty("holiday_flag") Double holidayFlag
    ) {}
}
