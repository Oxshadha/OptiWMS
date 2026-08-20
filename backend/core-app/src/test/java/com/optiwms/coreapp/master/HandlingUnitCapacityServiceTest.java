package com.optiwms.coreapp.master;

import com.optiwms.infra.master.LocationEntity;
import com.optiwms.infra.master.MaterialEntity;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class HandlingUnitCapacityServiceTest {
    private final HandlingUnitCapacityService service = new HandlingUnitCapacityService();

    @Test
    void resolvesExplicitUnitsPerPalletBeforePhysicalPalletSpaces() {
        MaterialEntity material = new MaterialEntity();
        material.setUnitsPerPallet(764);
        material.setPalletSpaces(BigDecimal.ONE);

        assertEquals(new BigDecimal("764"), service.resolveUnitsPerPallet(material));
        assertEquals(BigDecimal.ONE, service.resolvePalletFootprintSpaces(material));
        material.setWeightKg(BigDecimal.ONE);
        assertEquals(new BigDecimal("764"), service.resolvePalletWeightKg(material));
        assertEquals(2, service.computePalletCount(765, material));
    }

    @Test
    void retainsLegacyPalletSpacesFallback() {
        MaterialEntity material = new MaterialEntity();
        material.setPalletSpaces(new BigDecimal("48"));

        assertEquals(new BigDecimal("48"), service.resolveUnitsPerPallet(material));
    }

    /**
     * The numbers behind a putaway a worker was refused at the bin face: material 100171, 40
     * units of 12 kg into a 1200 kg bin. It fits four times over; only the full-pallet rating
     * of 1500 kg did not.
     */
    @Test
    void sizesTheFitCheckToTheQuantityBeingPlaced() {
        MaterialEntity material = new MaterialEntity();
        material.setMaterialCode("100171");
        material.setWeightKg(new java.math.BigDecimal("12.00"));
        material.setVolumeCm3(new java.math.BigDecimal("1000.00"));
        material.setUnitsPerPallet(373);
        material.setMaxPalletWeightKg(new java.math.BigDecimal("1500.00"));

        LocationEntity bin = new LocationEntity();
        bin.setLocationCode("A-01-04-1-A");
        bin.setMaxWeightKg(new java.math.BigDecimal("1200.00"));
        bin.setMaxVolumeCm3(new java.math.BigDecimal("1800000.00"));

        HandlingUnitCapacityService service = new HandlingUnitCapacityService();

        assertTrue(service.quantityFitsBin(material, bin, 40), "40 units weigh 480 kg into a 1200 kg bin");
        assertFalse(service.palletFitsBin(material, bin), "a full 1500 kg pallet genuinely does not fit");
        assertFalse(service.quantityFitsBin(material, bin, 200), "200 units weigh 2400 kg and must be refused");
    }
}
