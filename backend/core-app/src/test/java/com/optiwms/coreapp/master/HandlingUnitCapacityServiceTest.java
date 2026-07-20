package com.optiwms.coreapp.master;

import com.optiwms.infra.master.MaterialEntity;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;

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
}
