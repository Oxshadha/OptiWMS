package com.optiwms.domain.planning;

import com.optiwms.domain.common.BaseEntity;
import java.math.BigDecimal;

public class SupplyPlan extends BaseEntity {
    private java.util.UUID materialId;
    private java.util.UUID warehouseId;
    private Integer planYear;
    private Integer planMonth; // 1-12
    private BigDecimal plannedQuantity;
    private BigDecimal actualQuantity;
    private BigDecimal variance; // actual - planned

    public java.util.UUID getMaterialId() {
        return materialId;
    }

    public void setMaterialId(java.util.UUID materialId) {
        this.materialId = materialId;
    }

    public java.util.UUID getWarehouseId() {
        return warehouseId;
    }

    public void setWarehouseId(java.util.UUID warehouseId) {
        this.warehouseId = warehouseId;
    }

    public Integer getPlanYear() {
        return planYear;
    }

    public void setPlanYear(Integer planYear) {
        this.planYear = planYear;
    }

    public Integer getPlanMonth() {
        return planMonth;
    }

    public void setPlanMonth(Integer planMonth) {
        this.planMonth = planMonth;
    }

    public BigDecimal getPlannedQuantity() {
        return plannedQuantity;
    }

    public void setPlannedQuantity(BigDecimal plannedQuantity) {
        this.plannedQuantity = plannedQuantity;
    }

    public BigDecimal getActualQuantity() {
        return actualQuantity;
    }

    public void setActualQuantity(BigDecimal actualQuantity) {
        this.actualQuantity = actualQuantity;
        // Auto-calculate variance
        if (this.plannedQuantity != null && actualQuantity != null) {
            this.variance = actualQuantity.subtract(this.plannedQuantity);
        }
    }

    public BigDecimal getVariance() {
        return variance;
    }

    public void setVariance(BigDecimal variance) {
        this.variance = variance;
    }
}
