package com.optiwms.coreapp.master;

import com.optiwms.infra.master.LocationRepository;
import com.optiwms.infra.master.WarehouseEntity;
import com.optiwms.infra.master.WarehouseRepository;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class WarehouseServiceTest {

    @Test
    void listsActiveV8WarehouseBeforeOperationalFallbacks() {
        WarehouseRepository repository = mock(WarehouseRepository.class);
        WarehouseEntity baseline = warehouse(
                "CMB-MAIN", "PROJECT_OPERATIONAL_BASELINE_V3", "active");
        WarehouseEntity v8 = warehouse(
                "WH-001", "PROJECT_OPERATIONAL_SIMULATION_V8", "ACTIVE");
        WarehouseEntity manual = warehouse(
                "MANUAL-01", "OPERATIONAL_ENTRY", "active");
        WarehouseEntity inactiveV8 = warehouse(
                "WH-ARCHIVE", "PROJECT_OPERATIONAL_SIMULATION_V8", "inactive");
        when(repository.findByDatasetVersionIn(anyList()))
                .thenReturn(List.of(baseline, inactiveV8, manual, v8));

        var warehouses = new WarehouseService(repository, mock(LocationRepository.class)).listOperational();

        assertEquals(
                List.of("WH-001", "CMB-MAIN", "MANUAL-01"),
                warehouses.stream().map(warehouse -> warehouse.getCode()).toList());
    }

    @Test
    void listReceivableDropsWarehousesWithNoActiveStorage() {
        WarehouseRepository repository = mock(WarehouseRepository.class);
        LocationRepository locations = mock(LocationRepository.class);
        WarehouseEntity live = warehouse("WH-001", "PROJECT_OPERATIONAL_SIMULATION_V8", "ACTIVE");
        WarehouseEntity archived = warehouse("CMB-MAIN", "PROJECT_OPERATIONAL_BASELINE_V3", "active");
        UUID liveId = UUID.randomUUID();
        live.setId(liveId);
        archived.setId(UUID.randomUUID());
        when(repository.findByDatasetVersionIn(anyList())).thenReturn(List.of(archived, live));
        when(locations.findWarehouseIdsWithReceivableStorage()).thenReturn(List.of(liveId));

        var warehouses = new WarehouseService(repository, locations).listReceivable();

        assertEquals(
                List.of("WH-001"),
                warehouses.stream().map(warehouse -> warehouse.getCode()).toList());
    }

    private static WarehouseEntity warehouse(
            String code,
            String datasetVersion,
            String status
    ) {
        WarehouseEntity entity = new WarehouseEntity();
        entity.setCode(code);
        entity.setName(code);
        entity.setDatasetVersion(datasetVersion);
        entity.setStatus(status);
        return entity;
    }
}
