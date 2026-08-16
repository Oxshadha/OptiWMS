package com.optiwms.coreapp.master;

import com.optiwms.domain.master.Location;
import com.optiwms.infra.inventory.InventoryItemRepository;
import com.optiwms.infra.master.LocationEntity;
import com.optiwms.infra.master.LocationRepository;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class LocationServiceRackUpdateTest {

    private static final UUID WAREHOUSE_ID = UUID.randomUUID();

    @Test
    void keepsLegacyLocationCodeWhenOnlyRackStatusChanges() {
        // Legacy seeds store the bay unpadded. Re-canonicalising to "E-03-007-5-A" breaks the
        // inventory/material_default_locations foreign keys, which reference locations(location_code).
        LocationEntity legacy = bin("E-03-07-5-A", "E", "03", "07", 5, "A");
        LocationRepository repository = repositoryWith(legacy);
        InventoryItemRepository inventory = mock(InventoryItemRepository.class);
        when(inventory.existsByLocationCodeInAndQuantityGreaterThan(anyList(), anyInt())).thenReturn(false);

        LocationService service = new LocationService(repository, inventory);
        service.updateRackAttributes(legacy.getId(), attributes("maintenance"));

        assertEquals("E-03-07-5-A", legacy.getLocationCode());
        assertEquals("07", legacy.getBayNumber());
        assertEquals("maintenance", legacy.getRackStatus());
    }

    @Test
    void genericUpdateDoesNotReAddressABinThatDidNotMove() {
        LocationEntity legacy = bin("E-03-07-5-A", "E", "03", "07", 5, "A");
        LocationRepository repository = repositoryWith(legacy);
        LocationService service = new LocationService(repository, mock(InventoryItemRepository.class));

        Location request = new Location();
        request.setDescription("Bulk overflow");

        service.update(legacy.getId(), request);

        assertEquals("E-03-07-5-A", legacy.getLocationCode());
        assertEquals("07", legacy.getBayNumber());
        assertEquals("Bulk overflow", legacy.getDescription());
    }

    @Test
    void genericUpdateStillReAddressesABinThatActuallyMoved() {
        LocationEntity entity = bin("E-03-007-5-A", "E", "03", "007", 5, "A");
        LocationRepository repository = repositoryWith(entity);
        LocationService service = new LocationService(repository, mock(InventoryItemRepository.class));

        Location request = new Location();
        request.setBayNumber("9");

        service.update(entity.getId(), request);

        assertEquals("E-03-009-5-A", entity.getLocationCode());
        assertEquals("009", entity.getBayNumber());
    }

    @Test
    void rackUpdateCoversBinsWithMixedBayPadding() {
        // The layout UI treats "E-03-07" and "E-03-007" as one rack; the backend must agree,
        // otherwise a rack-wide status change silently leaves half the bins behind.
        LocationEntity canonical = bin("E-03-007-1-A", "E", "03", "007", 1, "A");
        LocationEntity legacy = bin("E-03-07-5-A", "E", "03", "07", 5, "A");
        LocationRepository repository = repositoryWith(canonical, legacy);
        InventoryItemRepository inventory = mock(InventoryItemRepository.class);
        when(inventory.existsByLocationCodeInAndQuantityGreaterThan(anyList(), anyInt())).thenReturn(false);

        LocationService service = new LocationService(repository, inventory);
        var result = service.updateRack(WAREHOUSE_ID, "E-03-007", attributes("maintenance"));

        assertEquals(2, result.updatedLocations());
        assertEquals("maintenance", canonical.getRackStatus());
        assertEquals("maintenance", legacy.getRackStatus());
        assertEquals("E-03-07-5-A", legacy.getLocationCode());
    }

    @Test
    void rackUpdateRejectsBlockingStatusWhileStockRemains() {
        LocationEntity occupied = bin("E-03-007-1-A", "E", "03", "007", 1, "A");
        LocationRepository repository = repositoryWith(occupied);
        InventoryItemRepository inventory = mock(InventoryItemRepository.class);
        when(inventory.existsByLocationCodeInAndQuantityGreaterThan(anyList(), anyInt())).thenReturn(true);

        LocationService service = new LocationService(repository, inventory);

        RuntimeException error = assertThrows(RuntimeException.class,
                () -> service.updateRack(WAREHOUSE_ID, "E-03-007", attributes("maintenance")));

        assertTrue(error.getMessage().contains("still holds stock"), error.getMessage());
        verify(repository, never()).saveAll(any());
        assertEquals("active", occupied.getRackStatus());
    }

    @Test
    void rackUpdateChecksStockOncePerRackNotOncePerBin() {
        LocationEntity[] bins = new LocationEntity[6];
        for (int i = 0; i < bins.length; i++) {
            bins[i] = bin("E-03-007-" + (i + 1) + "-A", "E", "03", "007", i + 1, "A");
        }
        LocationRepository repository = repositoryWith(bins);
        InventoryItemRepository inventory = mock(InventoryItemRepository.class);
        when(inventory.existsByLocationCodeInAndQuantityGreaterThan(anyList(), anyInt())).thenReturn(false);

        LocationService service = new LocationService(repository, inventory);
        service.updateRack(WAREHOUSE_ID, "E-03-007", attributes("reserved"));

        verify(inventory).existsByLocationCodeInAndQuantityGreaterThan(anyList(), eq(0));
        // The old per-bin flow scanned every location in the warehouse for each bin.
        verify(repository, never()).findByWarehouseId(any());
    }

    @Test
    void rackUpdateSkipsStockGuardWhenStatusIsUnchanged() {
        LocationEntity occupied = bin("E-03-007-1-A", "E", "03", "007", 1, "A");
        occupied.setRackStatus("maintenance");
        LocationRepository repository = repositoryWith(occupied);
        InventoryItemRepository inventory = mock(InventoryItemRepository.class);

        LocationService service = new LocationService(repository, inventory);
        var result = service.updateRack(WAREHOUSE_ID, "E-03-007", attributes("maintenance"));

        assertEquals(1, result.updatedLocations());
        verify(inventory, never()).existsByLocationCodeInAndQuantityGreaterThan(anyList(), anyInt());
    }

    @Test
    void rackUpdateFailsWhenRackHasNoBins() {
        LocationRepository repository = repositoryWith();
        LocationService service = new LocationService(repository, mock(InventoryItemRepository.class));

        RuntimeException error = assertThrows(RuntimeException.class,
                () -> service.updateRack(WAREHOUSE_ID, "E-03-007", attributes("maintenance")));

        assertTrue(error.getMessage().contains("No storage bins found"), error.getMessage());
    }

    @Test
    void capacityProfileAppliesPerLevelValuesToStorageBins() {
        LocationEntity level1 = bin("A-01-001-1-A", "A", "01", "001", 1, "A");
        LocationEntity level5 = bin("A-01-001-5-A", "A", "01", "001", 5, "A");
        LocationEntity otherZone = bin("B-01-001-1-A", "B", "01", "001", 1, "A");
        LocationRepository repository = repositoryWith(level1, level5, otherZone);
        LocationService service = new LocationService(repository, mock(InventoryItemRepository.class));

        int updated = service.applyCapacityProfile(
                WAREHOUSE_ID,
                "A",
                Map.of(
                        1, capacity(120),
                        5, capacity(80)),
                capacity(100));

        assertEquals(2, updated);
        assertEquals(0, new BigDecimal("120").compareTo(level1.getCapacity()));
        assertEquals(0, new BigDecimal("80").compareTo(level5.getCapacity()));
        assertEquals(0, new BigDecimal("1").compareTo(otherZone.getCapacity()));
    }

    private static LocationService.RackAttributes attributes(String rackStatus) {
        return new LocationService.RackAttributes(
                rackStatus, null, null, null, null, null, null, null, null, null);
    }

    private static LocationService.RackAttributes capacity(int units) {
        return new LocationService.RackAttributes(
                null, null, null, null, null, BigDecimal.valueOf(units), null, null, null, null);
    }

    private static LocationEntity bin(
            String locationCode, String area, String row, String bay, int level, String position) {
        LocationEntity entity = new LocationEntity();
        entity.setId(UUID.randomUUID());
        entity.setWarehouseId(WAREHOUSE_ID);
        entity.setLocationCode(locationCode);
        entity.setArea(area);
        entity.setRowNumber(row);
        entity.setBayNumber(bay);
        entity.setLevelNumber(level);
        entity.setBinPosition(position);
        entity.setLocationType("storage");
        entity.setZoneType("STORAGE");
        entity.setRackStatus("active");
        entity.setCapacity(BigDecimal.ONE);
        entity.setIsActive(true);
        return entity;
    }

    /**
     * Repository stub that resolves rack queries the way Postgres would, so tests exercise the
     * padding-variant lookup rather than a hand-fed result list.
     */
    private static LocationRepository repositoryWith(LocationEntity... entities) {
        List<LocationEntity> all = List.of(entities);
        LocationRepository repository = mock(LocationRepository.class);

        when(repository.findById(any())).thenAnswer(invocation -> all.stream()
                .filter(entity -> entity.getId().equals(invocation.getArgument(0)))
                .findFirst());

        when(repository.findRackLocations(any(), anyString(), any(), any())).thenAnswer(invocation -> {
            String area = invocation.getArgument(1);
            Collection<String> rows = invocation.getArgument(2);
            Collection<String> bays = invocation.getArgument(3);
            List<LocationEntity> matches = new ArrayList<>();
            for (LocationEntity entity : all) {
                if (entity.getArea().toUpperCase().equals(area)
                        && rows.contains(entity.getRowNumber())
                        && bays.contains(entity.getBayNumber())) {
                    matches.add(entity);
                }
            }
            return matches;
        });

        when(repository.findByWarehouseId(eq(WAREHOUSE_ID))).thenReturn(all);
        when(repository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(repository.saveAll(any())).thenAnswer(invocation -> {
            Iterable<LocationEntity> saved = invocation.getArgument(0);
            List<LocationEntity> result = new ArrayList<>();
            saved.forEach(result::add);
            return result;
        });

        return repository;
    }
}
