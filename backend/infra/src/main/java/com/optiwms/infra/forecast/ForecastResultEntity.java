package com.optiwms.infra.forecast;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "forecast_results")
public class ForecastResultEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @JdbcTypeCode(SqlTypes.UUID)
    @Column(name = "id", columnDefinition = "UUID", updatable = false)
    private UUID id;

    @Column(name = "material_id", nullable = false)
    @JdbcTypeCode(SqlTypes.UUID)
    private UUID materialId;

    @Column(name = "warehouse_id")
    @JdbcTypeCode(SqlTypes.UUID)
    private UUID warehouseId;

    @Column(name = "forecast_period", nullable = false)
    private LocalDate forecastPeriod;

    @Column(name = "horizon", nullable = false)
    private Integer horizon;

    @Column(name = "model_name", nullable = false, length = 64)
    private String modelName;

    @Column(name = "forecast_p10", precision = 14, scale = 2)
    private BigDecimal forecastP10;

    @Column(name = "forecast_p50", nullable = false, precision = 14, scale = 2)
    private BigDecimal forecastP50;

    @Column(name = "forecast_p90", precision = 14, scale = 2)
    private BigDecimal forecastP90;

    @Column(name = "actual_demand", precision = 14, scale = 2)
    private BigDecimal actualDemand;

    @Column(name = "wape", precision = 8, scale = 6)
    private BigDecimal wape;

    @Column(name = "method", length = 32)
    private String method;

    @Column(name = "mlflow_run_id", length = 64)
    private String mlflowRunId;

    @Column(name = "created_at", updatable = false)
    private OffsetDateTime createdAt;

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getMaterialId() { return materialId; }
    public void setMaterialId(UUID materialId) { this.materialId = materialId; }
    public UUID getWarehouseId() { return warehouseId; }
    public void setWarehouseId(UUID warehouseId) { this.warehouseId = warehouseId; }
    public LocalDate getForecastPeriod() { return forecastPeriod; }
    public void setForecastPeriod(LocalDate forecastPeriod) { this.forecastPeriod = forecastPeriod; }
    public Integer getHorizon() { return horizon; }
    public void setHorizon(Integer horizon) { this.horizon = horizon; }
    public String getModelName() { return modelName; }
    public void setModelName(String modelName) { this.modelName = modelName; }
    public BigDecimal getForecastP10() { return forecastP10; }
    public void setForecastP10(BigDecimal forecastP10) { this.forecastP10 = forecastP10; }
    public BigDecimal getForecastP50() { return forecastP50; }
    public void setForecastP50(BigDecimal forecastP50) { this.forecastP50 = forecastP50; }
    public BigDecimal getForecastP90() { return forecastP90; }
    public void setForecastP90(BigDecimal forecastP90) { this.forecastP90 = forecastP90; }
    public BigDecimal getActualDemand() { return actualDemand; }
    public void setActualDemand(BigDecimal actualDemand) { this.actualDemand = actualDemand; }
    public BigDecimal getWape() { return wape; }
    public void setWape(BigDecimal wape) { this.wape = wape; }
    public String getMethod() { return method; }
    public void setMethod(String method) { this.method = method; }
    public String getMlflowRunId() { return mlflowRunId; }
    public void setMlflowRunId(String mlflowRunId) { this.mlflowRunId = mlflowRunId; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }
}
