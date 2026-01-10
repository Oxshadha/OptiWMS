package com.optiwms.infra.cyclecount;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Entity for tracking cycle count recount history
 * Used when variance exceeds threshold and requires re-counting
 */
@Entity
@Table(name = "cycle_count_recounts")
public class CycleCountRecountEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @JdbcTypeCode(SqlTypes.UUID)
    @Column(name = "id", columnDefinition = "UUID", updatable = false)
    private UUID id;

    @Column(name = "cycle_count_id", columnDefinition = "UUID", nullable = false)
    private UUID cycleCountId;

    @Column(name = "recount_number", nullable = false)
    private Integer recountNumber;

    @Column(name = "counted_quantity", precision = 15, scale = 2, nullable = false)
    private BigDecimal countedQuantity;

    @Column(name = "variance", precision = 15, scale = 2, nullable = false)
    private BigDecimal variance;

    @Column(name = "counted_by", columnDefinition = "UUID")
    private UUID countedBy;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @Column(name = "counted_at")
    private LocalDateTime countedAt;

    @PrePersist
    protected void onCreate() {
        if (countedAt == null) {
            countedAt = LocalDateTime.now();
        }
    }

    // Getters and Setters
    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public UUID getCycleCountId() {
        return cycleCountId;
    }

    public void setCycleCountId(UUID cycleCountId) {
        this.cycleCountId = cycleCountId;
    }

    public Integer getRecountNumber() {
        return recountNumber;
    }

    public void setRecountNumber(Integer recountNumber) {
        this.recountNumber = recountNumber;
    }

    public BigDecimal getCountedQuantity() {
        return countedQuantity;
    }

    public void setCountedQuantity(BigDecimal countedQuantity) {
        this.countedQuantity = countedQuantity;
    }

    public BigDecimal getVariance() {
        return variance;
    }

    public void setVariance(BigDecimal variance) {
        this.variance = variance;
    }

    public UUID getCountedBy() {
        return countedBy;
    }

    public void setCountedBy(UUID countedBy) {
        this.countedBy = countedBy;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }

    public LocalDateTime getCountedAt() {
        return countedAt;
    }

    public void setCountedAt(LocalDateTime countedAt) {
        this.countedAt = countedAt;
    }
}
