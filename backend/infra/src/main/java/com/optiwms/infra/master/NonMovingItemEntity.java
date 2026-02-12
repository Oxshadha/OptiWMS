package com.optiwms.infra.master;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(
        name = "non_moving_items",
        uniqueConstraints = @UniqueConstraint(columnNames = {"material_id", "warehouse_id"})
)
public class NonMovingItemEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @JdbcTypeCode(SqlTypes.UUID)
    @Column(name = "id", columnDefinition = "UUID", updatable = false)
    private UUID id;

    @Column(name = "material_id", columnDefinition = "UUID", nullable = false)
    private UUID materialId;

    @Column(name = "warehouse_id", columnDefinition = "UUID", nullable = false)
    private UUID warehouseId;

    @Column(name = "last_movement_date")
    private LocalDate lastMovementDate;

    @Column(name = "days_since_last_movement")
    private Integer daysSinceLastMovement;

    @Column(name = "flagged_at")
    private LocalDateTime flaggedAt;

    @PrePersist
    protected void onCreate() {
        if (flaggedAt == null) {
            flaggedAt = LocalDateTime.now();
        }
    }

    @PreUpdate
    protected void onUpdate() {
        flaggedAt = LocalDateTime.now();
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public UUID getMaterialId() {
        return materialId;
    }

    public void setMaterialId(UUID materialId) {
        this.materialId = materialId;
    }

    public UUID getWarehouseId() {
        return warehouseId;
    }

    public void setWarehouseId(UUID warehouseId) {
        this.warehouseId = warehouseId;
    }

    public LocalDate getLastMovementDate() {
        return lastMovementDate;
    }

    public void setLastMovementDate(LocalDate lastMovementDate) {
        this.lastMovementDate = lastMovementDate;
    }

    public Integer getDaysSinceLastMovement() {
        return daysSinceLastMovement;
    }

    public void setDaysSinceLastMovement(Integer daysSinceLastMovement) {
        this.daysSinceLastMovement = daysSinceLastMovement;
    }

    public LocalDateTime getFlaggedAt() {
        return flaggedAt;
    }

    public void setFlaggedAt(LocalDateTime flaggedAt) {
        this.flaggedAt = flaggedAt;
    }
}
