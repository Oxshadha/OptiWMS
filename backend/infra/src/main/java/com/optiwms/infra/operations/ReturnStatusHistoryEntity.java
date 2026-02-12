package com.optiwms.infra.operations;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "return_status_history")
public class ReturnStatusHistoryEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @JdbcTypeCode(SqlTypes.UUID)
    @Column(name = "id", columnDefinition = "UUID", updatable = false)
    private UUID id;

    @Column(name = "return_id", columnDefinition = "UUID", nullable = false)
    private UUID returnId;

    @Column(name = "from_status", length = 50)
    private String fromStatus;

    @Column(name = "to_status", length = 50, nullable = false)
    private String toStatus;

    @Column(name = "changed_by", columnDefinition = "UUID")
    private UUID changedBy;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @Column(name = "changed_at", nullable = false, updatable = false)
    private OffsetDateTime changedAt;

    @PrePersist
    protected void onCreate() {
        if (changedAt == null) {
            changedAt = OffsetDateTime.now();
        }
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public UUID getReturnId() {
        return returnId;
    }

    public void setReturnId(UUID returnId) {
        this.returnId = returnId;
    }

    public String getFromStatus() {
        return fromStatus;
    }

    public void setFromStatus(String fromStatus) {
        this.fromStatus = fromStatus;
    }

    public String getToStatus() {
        return toStatus;
    }

    public void setToStatus(String toStatus) {
        this.toStatus = toStatus;
    }

    public UUID getChangedBy() {
        return changedBy;
    }

    public void setChangedBy(UUID changedBy) {
        this.changedBy = changedBy;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }

    public OffsetDateTime getChangedAt() {
        return changedAt;
    }

    public void setChangedAt(OffsetDateTime changedAt) {
        this.changedAt = changedAt;
    }
}

