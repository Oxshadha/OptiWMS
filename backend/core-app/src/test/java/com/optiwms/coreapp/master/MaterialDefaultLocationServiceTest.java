package com.optiwms.coreapp.master;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class MaterialDefaultLocationServiceTest {

    @Test
    void acceptsPickFacesAndReserveStorageButRejectsTransitZones() {
        assertTrue(MaterialDefaultLocationService.isOperationalStorageLocation("picking", "PICK_FACE"));
        assertTrue(MaterialDefaultLocationService.isOperationalStorageLocation("storage", "RESERVE"));
        assertTrue(MaterialDefaultLocationService.isOperationalStorageLocation("storage", null));
        assertFalse(MaterialDefaultLocationService.isOperationalStorageLocation("staging", "STAGING"));
        assertFalse(MaterialDefaultLocationService.isOperationalStorageLocation("dispatch", "DISPATCH"));
    }
}
