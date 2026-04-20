package com.optiwms.infra.planning;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "forecast_sku_mapping")
public class ForecastSkuMappingEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @JdbcTypeCode(SqlTypes.UUID)
    @Column(name = "id", columnDefinition = "UUID", updatable = false)
    private UUID id;

    @Column(name = "dataset", length = 32)
    private String dataset;

    @Column(name = "forecast_sku", nullable = false, length = 64)
    private String forecastSku;

    @Column(name = "wms_material_id", columnDefinition = "UUID", nullable = false)
    private UUID wmsMaterialId;

    @Column(name = "warehouse_id", columnDefinition = "UUID")
    private UUID warehouseId;

    @Column(name = "is_active", nullable = false)
    private Boolean isActive = Boolean.TRUE;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public String getDataset() { return dataset; }
    public void setDataset(String dataset) { this.dataset = dataset; }
    public String getForecastSku() { return forecastSku; }
    public void setForecastSku(String forecastSku) { this.forecastSku = forecastSku; }
    public UUID getWmsMaterialId() { return wmsMaterialId; }
    public void setWmsMaterialId(UUID wmsMaterialId) { this.wmsMaterialId = wmsMaterialId; }
    public UUID getWarehouseId() { return warehouseId; }
    public void setWarehouseId(UUID warehouseId) { this.warehouseId = warehouseId; }
    public Boolean getIsActive() { return isActive; }
    public void setIsActive(Boolean active) { isActive = active; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
