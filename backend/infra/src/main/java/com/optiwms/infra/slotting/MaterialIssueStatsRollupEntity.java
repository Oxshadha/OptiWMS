package com.optiwms.infra.slotting;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.io.Serializable;
import java.time.OffsetDateTime;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name = "material_issue_stats_rollup")
@IdClass(MaterialIssueStatsRollupEntity.RollupId.class)
public class MaterialIssueStatsRollupEntity {

    @Id
    @Column(name = "material_id", nullable = false)
    @JdbcTypeCode(SqlTypes.UUID)
    private UUID materialId;

    @Id
    @Column(name = "warehouse_id", nullable = false)
    @JdbcTypeCode(SqlTypes.UUID)
    private UUID warehouseId;

    @Column(name = "issue_volume_12m", nullable = false)
    private Long issueVolume12m;

    @Column(name = "issue_count_12m", nullable = false)
    private Integer issueCount12m;

    @Column(name = "abc_class", length = 1)
    private String abcClass;

    @Column(name = "fms_class", length = 1)
    private String fmsClass;

    @Column(name = "amalgamated_class", length = 2)
    private String amalgamatedClass;

    @Column(name = "last_refreshed_at", nullable = false)
    private OffsetDateTime lastRefreshedAt;

    @PrePersist
    @PreUpdate
    protected void touch() {
        lastRefreshedAt = OffsetDateTime.now();
        if (issueVolume12m == null) {
            issueVolume12m = 0L;
        }
        if (issueCount12m == null) {
            issueCount12m = 0;
        }
    }

    public static class RollupId implements Serializable {
        private UUID materialId;
        private UUID warehouseId;

        public RollupId() {}

        public RollupId(UUID materialId, UUID warehouseId) {
            this.materialId = materialId;
            this.warehouseId = warehouseId;
        }

        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (!(o instanceof RollupId that)) return false;
            return Objects.equals(materialId, that.materialId)
                    && Objects.equals(warehouseId, that.warehouseId);
        }

        @Override
        public int hashCode() {
            return Objects.hash(materialId, warehouseId);
        }
    }

    public UUID getMaterialId() { return materialId; }
    public void setMaterialId(UUID materialId) { this.materialId = materialId; }
    public UUID getWarehouseId() { return warehouseId; }
    public void setWarehouseId(UUID warehouseId) { this.warehouseId = warehouseId; }
    public Long getIssueVolume12m() { return issueVolume12m; }
    public void setIssueVolume12m(Long issueVolume12m) { this.issueVolume12m = issueVolume12m; }
    public Integer getIssueCount12m() { return issueCount12m; }
    public void setIssueCount12m(Integer issueCount12m) { this.issueCount12m = issueCount12m; }
    public String getAbcClass() { return abcClass; }
    public void setAbcClass(String abcClass) { this.abcClass = abcClass; }
    public String getFmsClass() { return fmsClass; }
    public void setFmsClass(String fmsClass) { this.fmsClass = fmsClass; }
    public String getAmalgamatedClass() { return amalgamatedClass; }
    public void setAmalgamatedClass(String amalgamatedClass) { this.amalgamatedClass = amalgamatedClass; }
    public OffsetDateTime getLastRefreshedAt() { return lastRefreshedAt; }
    public void setLastRefreshedAt(OffsetDateTime lastRefreshedAt) { this.lastRefreshedAt = lastRefreshedAt; }
}
