package com.optiwms.infra.slotting;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "slotting_plan_reserve_lines")
public class SlottingPlanReserveLineEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @JdbcTypeCode(SqlTypes.UUID)
    @Column(name = "id", columnDefinition = "UUID", updatable = false)
    private UUID id;

    @Column(name = "plan_line_id", nullable = false)
    @JdbcTypeCode(SqlTypes.UUID)
    private UUID planLineId;

    @Column(name = "recommended_reserve_location_code", nullable = false, length = 128)
    private String recommendedReserveLocationCode;

    @Column(name = "final_reserve_location_code", length = 128)
    private String finalReserveLocationCode;

    @Column(name = "reserve_pallet_positions", nullable = false)
    private Integer reservePalletPositions;

    @Column(name = "reserve_zone_hint", length = 64)
    private String reserveZoneHint;

    @Column(name = "sequence_no", nullable = false)
    private Integer sequenceNo;

    @Column(name = "created_at", updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        OffsetDateTime now = OffsetDateTime.now();
        createdAt = now;
        updatedAt = now;
        if (reservePalletPositions == null) {
            reservePalletPositions = 1;
        }
        if (sequenceNo == null) {
            sequenceNo = 1;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = OffsetDateTime.now();
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getPlanLineId() { return planLineId; }
    public void setPlanLineId(UUID planLineId) { this.planLineId = planLineId; }
    public String getRecommendedReserveLocationCode() { return recommendedReserveLocationCode; }
    public void setRecommendedReserveLocationCode(String recommendedReserveLocationCode) { this.recommendedReserveLocationCode = recommendedReserveLocationCode; }
    public String getFinalReserveLocationCode() { return finalReserveLocationCode; }
    public void setFinalReserveLocationCode(String finalReserveLocationCode) { this.finalReserveLocationCode = finalReserveLocationCode; }
    public Integer getReservePalletPositions() { return reservePalletPositions; }
    public void setReservePalletPositions(Integer reservePalletPositions) { this.reservePalletPositions = reservePalletPositions; }
    public String getReserveZoneHint() { return reserveZoneHint; }
    public void setReserveZoneHint(String reserveZoneHint) { this.reserveZoneHint = reserveZoneHint; }
    public Integer getSequenceNo() { return sequenceNo; }
    public void setSequenceNo(Integer sequenceNo) { this.sequenceNo = sequenceNo; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(OffsetDateTime updatedAt) { this.updatedAt = updatedAt; }
}
