package com.optiwms.coreapi.dock;

import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;

class DockManagementFeatureGateTest {

    @Test
    void controllerIsExplicitlyDefaultOff() {
        ConditionalOnProperty gate =
                DockManagementController.class.getAnnotation(ConditionalOnProperty.class);

        assertNotNull(gate, "Dock management must remain behind a feature gate");
        assertArrayEquals(
                new String[]{"optiwms.features.dock-management.enabled"},
                gate.name()
        );
        assertEquals("true", gate.havingValue());
        assertFalse(gate.matchIfMissing(), "Missing configuration must not expose dock APIs");
    }
}
