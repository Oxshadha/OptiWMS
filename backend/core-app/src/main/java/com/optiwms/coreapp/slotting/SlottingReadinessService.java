package com.optiwms.coreapp.slotting;

import com.optiwms.infra.master.LocationEntity;
import com.optiwms.infra.master.LocationRepository;
import com.optiwms.infra.master.MaterialEntity;
import com.optiwms.infra.master.MaterialRepository;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
public class SlottingReadinessService {

    private static final double MATERIAL_THRESHOLD_PCT = 80.0;
    private static final double LOCATION_THRESHOLD_PCT = 90.0;

    private final MaterialRepository materialRepository;
    private final LocationRepository locationRepository;

    public SlottingReadinessService(
            MaterialRepository materialRepository,
            LocationRepository locationRepository) {
        this.materialRepository = materialRepository;
        this.locationRepository = locationRepository;
    }

    public ReadinessReport assess(UUID warehouseId) {
        List<MaterialEntity> materials = materialRepository.findAll().stream()
                .filter(m -> isSlottingMaterial(m.getMaterialType()))
                .toList();

        int materialsTotal = materials.size();
        int materialsReady = (int) materials.stream().filter(this::hasCompleteDimensions).count();
        double materialsPct = materialsTotal == 0 ? 0
                : (materialsReady * 100.0) / materialsTotal;

        List<LocationEntity> locations = locationRepository.findByWarehouseIdAndIsActive(warehouseId, true).stream()
                .filter(this::isStorageLocation)
                .toList();

        int locationsTotal = locations.size();
        int locationsReady = (int) locations.stream().filter(this::hasCapacityConstraints).count();
        double locationsPct = locationsTotal == 0 ? 0
                : (locationsReady * 100.0) / locationsTotal;

        List<String> blockers = new ArrayList<>();
        materials.stream()
                .filter(m -> !hasCompleteDimensions(m))
                .limit(10)
                .forEach(m -> blockers.add(m.getMaterialCode() + " — missing L/W/H/weight/volume"));

        if (materialsPct < MATERIAL_THRESHOLD_PCT) {
            blockers.add(0, String.format(
                    "Only %.0f%% of materials have complete dimensions (need %.0f%%)",
                    materialsPct, MATERIAL_THRESHOLD_PCT));
        }
        if (locationsPct < LOCATION_THRESHOLD_PCT) {
            blockers.add(String.format(
                    "Only %.0f%% of storage locations have weight/volume caps (need %.0f%%)",
                    locationsPct, LOCATION_THRESHOLD_PCT));
        }

        boolean ready = materialsPct >= MATERIAL_THRESHOLD_PCT && locationsPct >= LOCATION_THRESHOLD_PCT;

        return new ReadinessReport(
                ready,
                round(materialsPct),
                materialsReady,
                materialsTotal,
                round(locationsPct),
                locationsReady,
                locationsTotal,
                blockers);
    }

    public void assertReady(UUID warehouseId) {
        ReadinessReport report = assess(warehouseId);
        if (!report.ready()) {
            String message = report.blockers().isEmpty()
                    ? "Master data not ready for slotting"
                    : report.blockers().get(0);
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.BAD_REQUEST, message);
        }
    }

    private boolean isSlottingMaterial(String materialType) {
        if (materialType == null || materialType.isBlank()) {
            return true;
        }
        String t = materialType.toLowerCase();
        return t.equals("raw_material") || t.equals("packaging_material") || t.equals("packaging")
                || t.equals("product") || t.equals("fg");
    }

    private boolean hasCompleteDimensions(MaterialEntity m) {
        return isPositive(m.getLengthCm())
                && isPositive(m.getWidthCm())
                && isPositive(m.getHeightCm())
                && isPositive(m.getWeightKg())
                && isPositive(m.getVolumeCm3())
                && isPositive(m.getPalletSpaces());
    }

    private boolean isPositive(BigDecimal value) {
        return value != null && value.doubleValue() > 0;
    }

    private boolean isStorageLocation(LocationEntity loc) {
        String type = loc.getLocationType() != null ? loc.getLocationType().toLowerCase() : "";
        return type.contains("storage") || loc.getZoneType() != null;
    }

    private boolean hasCapacityConstraints(LocationEntity loc) {
        return loc.getMaxWeightKg() != null && loc.getMaxWeightKg().doubleValue() > 0
                && loc.getMaxVolumeCm3() != null && loc.getMaxVolumeCm3().doubleValue() > 0;
    }

    private double round(double value) {
        return Math.round(value * 10.0) / 10.0;
    }

    public record ReadinessReport(
            boolean ready,
            double materialsReadyPct,
            int materialsReadyCount,
            int materialsTotalCount,
            double locationsReadyPct,
            int locationsReadyCount,
            int locationsTotalCount,
            List<String> blockers) {}
}
