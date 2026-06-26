package com.optiwms.coreapp.slotting;

import com.optiwms.infra.master.LocationEntity;
import com.optiwms.infra.master.LocationRepository;
import com.optiwms.infra.master.MaterialEntity;
import com.optiwms.infra.master.MaterialRepository;
import com.optiwms.infra.slotting.MaterialIssueStatsRollupEntity;
import com.optiwms.infra.slotting.MaterialIssueStatsRollupRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;

@Service
public class SlottingGaProxyService {

    private static final Logger log = LoggerFactory.getLogger(SlottingGaProxyService.class);

    private final RestTemplate restTemplate;
    private final MaterialRepository materialRepository;
    private final LocationRepository locationRepository;
    private final MaterialIssueStatsRollupRepository rollupRepository;
    private final SlottingReadinessService readinessService;

    @Value("${ai.services.slotting-base-url:http://localhost:8093}")
    private String slottingBaseUrl;

    @Value("${ai.services.auth-token:}")
    private String authToken;

    public SlottingGaProxyService(
            RestTemplate restTemplate,
            MaterialRepository materialRepository,
            LocationRepository locationRepository,
            MaterialIssueStatsRollupRepository rollupRepository,
            SlottingReadinessService readinessService) {
        this.restTemplate = restTemplate;
        this.materialRepository = materialRepository;
        this.locationRepository = locationRepository;
        this.rollupRepository = rollupRepository;
        this.readinessService = readinessService;
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> optimize(GaOptimizeRequest request) {
        UUID warehouseId = UUID.fromString(request.warehouseId());

        SlottingReadinessService.ReadinessReport readiness = readinessService.assess(warehouseId);
        if (!readiness.ready()) {
            long missingDims = readiness.materialsTotalCount() - readiness.materialsReadyCount();
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    missingDims + " materials missing dimensions — complete Product Catalog before optimizing");
        }

        List<MaterialEntity> materials = materialRepository.findAll();
        List<LocationEntity> locations = locationRepository.findByWarehouseIdAndIsActive(warehouseId, true);
        Map<UUID, MaterialIssueStatsRollupEntity> rollups = new HashMap<>();
        for (MaterialIssueStatsRollupEntity r : rollupRepository.findByWarehouseId(warehouseId)) {
            rollups.put(r.getMaterialId(), r);
        }

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("warehouse_id", request.warehouseId());
        body.put("population_size", request.populationSize() != null ? request.populationSize() : 50);
        body.put("generations", request.generations() != null ? request.generations() : 100);
        body.put("mutation_rate", request.mutationRate() != null ? request.mutationRate() : 0.2);

        List<Map<String, Object>> matPayload = new ArrayList<>();
        for (MaterialEntity m : materials) {
            if (m.getWeightKg() == null || m.getVolumeCm3() == null) {
                continue;
            }
            MaterialIssueStatsRollupEntity rollup = rollups.get(m.getId());
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("material_id", m.getId().toString());
            row.put("material_code", m.getMaterialCode());
            row.put("weight_kg", m.getWeightKg().doubleValue());
            row.put("volume_cm3", m.getVolumeCm3().doubleValue());
            row.put("length_cm", m.getLengthCm() != null ? m.getLengthCm().doubleValue() : null);
            row.put("width_cm", m.getWidthCm() != null ? m.getWidthCm().doubleValue() : null);
            row.put("height_cm", m.getHeightCm() != null ? m.getHeightCm().doubleValue() : null);
            row.put("pallet_spaces", m.getPalletSpaces() != null ? m.getPalletSpaces().doubleValue() : 1);
            row.put("abc_class", rollup != null ? rollup.getAbcClass() : "C");
            row.put("fms_class", rollup != null ? rollup.getFmsClass() : "S");
            row.put("velocity", rollup != null && rollup.getIssueVolume12m() != null
                    ? rollup.getIssueVolume12m().doubleValue() : 0);
            matPayload.add(row);
        }
        body.put("materials", matPayload);

        List<Map<String, Object>> locPayload = new ArrayList<>();
        for (LocationEntity loc : locations) {
            if (loc.getMaxWeightKg() == null || loc.getMaxVolumeCm3() == null) {
                continue;
            }
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("location_id", loc.getId().toString());
            row.put("location_code", loc.getLocationCode());
            row.put("max_weight_kg", loc.getMaxWeightKg().doubleValue());
            row.put("max_volume_cm3", loc.getMaxVolumeCm3().doubleValue());
            row.put("capacity", loc.getCapacity() != null ? loc.getCapacity().doubleValue() : null);
            row.put("max_pallet_capacity", loc.getMaxPalletCapacity());
            row.put("coordinate_x", loc.getCoordinateX() != null ? loc.getCoordinateX().doubleValue() : 0);
            row.put("coordinate_y", loc.getCoordinateY() != null ? loc.getCoordinateY().doubleValue() : 0);
            row.put("amalgamated_class", loc.getAmalgamatedClass());
            row.put("level_number", loc.getLevelNumber());
            locPayload.add(row);
        }
        body.put("locations", locPayload);

        if (matPayload.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "No materials with dimensions found for warehouse optimization");
        }
        if (locPayload.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "No storage locations with capacity constraints found");
        }

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            if (authToken != null && !authToken.isBlank()) {
                headers.setBearerAuth(authToken);
            }
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);
            Map<String, Object> response = restTemplate.postForObject(
                    slottingBaseUrl + "/api/v1/slotting/optimize-wms",
                    entity,
                    Map.class);
            if (response == null) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Empty response from slotting service");
            }
            return response;
        } catch (RestClientException e) {
            log.warn("GA optimize-wms failed: {}", e.getMessage());
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "Slotting service unavailable: " + e.getMessage());
        }
    }

    public record GaOptimizeRequest(
            String warehouseId,
            Integer populationSize,
            Integer generations,
            Double mutationRate) {}
}
