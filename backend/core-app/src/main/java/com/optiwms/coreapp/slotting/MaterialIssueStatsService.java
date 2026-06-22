package com.optiwms.coreapp.slotting;

import com.optiwms.infra.master.MaterialEntity;
import com.optiwms.infra.master.MaterialRepository;
import com.optiwms.infra.operations.OperationEventEntity;
import com.optiwms.infra.operations.OperationEventRepository;
import com.optiwms.infra.slotting.MaterialIssueStatsEntity;
import com.optiwms.infra.slotting.MaterialIssueStatsRepository;
import com.optiwms.infra.slotting.MaterialIssueStatsRollupEntity;
import com.optiwms.infra.slotting.MaterialIssueStatsRollupRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.YearMonth;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class MaterialIssueStatsService {

    private static final Set<String> ISSUE_OPS = Set.of(
            "PICK", "PICKED", "PICKING", "ISSUE", "ISSUED", "SHIP", "SHIPPED", "TRANSFER_OUT");

    private final OperationEventRepository operationEventRepository;
    private final MaterialIssueStatsRepository statsRepository;
    private final MaterialIssueStatsRollupRepository rollupRepository;
    private final MaterialRepository materialRepository;

    public MaterialIssueStatsService(
            OperationEventRepository operationEventRepository,
            MaterialIssueStatsRepository statsRepository,
            MaterialIssueStatsRollupRepository rollupRepository,
            MaterialRepository materialRepository) {
        this.operationEventRepository = operationEventRepository;
        this.statsRepository = statsRepository;
        this.rollupRepository = rollupRepository;
        this.materialRepository = materialRepository;
    }

    @Transactional
    public OffsetDateTime refreshForWarehouse(UUID warehouseId) {
        LocalDateTime end = LocalDateTime.now();
        LocalDateTime start = end.minusMonths(12);
        List<OperationEventEntity> events = operationEventRepository
                .findByWarehouseAndCompletedAtBetween(warehouseId, start, end);

        Map<MonthKey, long[]> monthly = new HashMap<>();
        for (OperationEventEntity event : events) {
            if (!isIssueEvent(event)) {
                continue;
            }
            if (event.getMaterialId() == null || event.getCompletedAt() == null) {
                continue;
            }
            long qty = event.getQuantity() != null ? event.getQuantity() : 0L;
            YearMonth ym = YearMonth.from(event.getCompletedAt());
            MonthKey key = new MonthKey(event.getMaterialId(), ym);
            long[] acc = monthly.computeIfAbsent(key, k -> new long[2]);
            acc[0] += qty;
            acc[1] += 1;
        }

        for (Map.Entry<MonthKey, long[]> entry : monthly.entrySet()) {
            MonthKey key = entry.getKey();
            MaterialIssueStatsEntity row = statsRepository
                    .findByWarehouseIdAndMaterialId(warehouseId, key.materialId()).stream()
                    .filter(s -> s.getPeriodMonth().equals(key.month().atDay(1)))
                    .findFirst()
                    .orElseGet(MaterialIssueStatsEntity::new);
            row.setMaterialId(key.materialId());
            row.setWarehouseId(warehouseId);
            row.setPeriodMonth(key.month().atDay(1));
            row.setIssueVolume(entry.getValue()[0]);
            row.setIssueCount((int) entry.getValue()[1]);
            statsRepository.save(row);
        }

        Map<UUID, long[]> rollupTotals = new HashMap<>();
        for (Map.Entry<MonthKey, long[]> entry : monthly.entrySet()) {
            long[] acc = rollupTotals.computeIfAbsent(entry.getKey().materialId(), k -> new long[2]);
            acc[0] += entry.getValue()[0];
            acc[1] += entry.getValue()[1];
        }

        List<MaterialEntity> materials = materialRepository.findAll().stream()
                .filter(m -> isSlottingMaterialType(m.getMaterialType()))
                .toList();

        Map<String, List<MaterialEntity>> byType = materials.stream()
                .collect(Collectors.groupingBy(m -> normalizeMaterialType(m.getMaterialType())));

        Map<UUID, AbcFmsClasses> classification = new HashMap<>();
        for (List<MaterialEntity> group : byType.values()) {
            classification.putAll(classifyGroup(warehouseId, group, rollupTotals));
        }

        OffsetDateTime refreshedAt = OffsetDateTime.now();
        for (MaterialEntity material : materials) {
            long[] totals = rollupTotals.getOrDefault(material.getId(), new long[]{0, 0});
            AbcFmsClasses classes = classification.getOrDefault(
                    material.getId(), new AbcFmsClasses("C", "S", "CS"));

            MaterialIssueStatsRollupEntity rollup = rollupRepository
                    .findById(new MaterialIssueStatsRollupEntity.RollupId(material.getId(), warehouseId))
                    .orElseGet(MaterialIssueStatsRollupEntity::new);
            rollup.setMaterialId(material.getId());
            rollup.setWarehouseId(warehouseId);
            rollup.setIssueVolume12m(totals[0]);
            rollup.setIssueCount12m((int) totals[1]);
            rollup.setAbcClass(classes.abc());
            rollup.setFmsClass(classes.fms());
            rollup.setAmalgamatedClass(classes.amalgamated());
            rollup.setLastRefreshedAt(refreshedAt);
            rollupRepository.save(rollup);
        }

        return refreshedAt;
    }

    public List<MaterialIssueStatsRollupEntity> getRollupForWarehouse(UUID warehouseId) {
        return rollupRepository.findByWarehouseId(warehouseId);
    }

    private Map<UUID, AbcFmsClasses> classifyGroup(
            UUID warehouseId,
            List<MaterialEntity> materials,
            Map<UUID, long[]> rollupTotals) {

        List<MaterialEntity> sortedByVolume = materials.stream()
                .sorted(Comparator.comparingLong(
                        (MaterialEntity m) -> rollupTotals.getOrDefault(m.getId(), new long[]{0})[0]).reversed())
                .toList();

        long totalVolume = sortedByVolume.stream()
                .mapToLong(m -> rollupTotals.getOrDefault(m.getId(), new long[]{0})[0])
                .sum();

        Map<UUID, String> abc = new HashMap<>();
        if (totalVolume <= 0) {
            for (MaterialEntity m : materials) {
                abc.put(m.getId(), "C");
            }
        } else {
            double cumulative = 0;
            for (MaterialEntity m : sortedByVolume) {
                long vol = rollupTotals.getOrDefault(m.getId(), new long[]{0})[0];
                cumulative += vol;
                double pct = cumulative / totalVolume;
                if (pct <= 0.80) {
                    abc.put(m.getId(), "A");
                } else if (pct <= 0.95) {
                    abc.put(m.getId(), "B");
                } else {
                    abc.put(m.getId(), "C");
                }
            }
        }

        List<MaterialEntity> sortedByCount = materials.stream()
                .sorted(Comparator.comparingInt(
                        (MaterialEntity m) -> (int) rollupTotals.getOrDefault(m.getId(), new long[]{0})[1]).reversed())
                .toList();

        int n = sortedByCount.size();
        Map<UUID, String> fms = new HashMap<>();
        for (int i = 0; i < n; i++) {
            MaterialEntity m = sortedByCount.get(i);
            double rank = (i + 1.0) / Math.max(n, 1);
            if (rank <= 0.33) {
                fms.put(m.getId(), "F");
            } else if (rank <= 0.66) {
                fms.put(m.getId(), "M");
            } else {
                fms.put(m.getId(), "S");
            }
        }

        Map<UUID, AbcFmsClasses> result = new HashMap<>();
        for (MaterialEntity m : materials) {
            String a = abc.getOrDefault(m.getId(), "C");
            String f = fms.getOrDefault(m.getId(), "S");
            result.put(m.getId(), new AbcFmsClasses(a, f, a + f));
        }
        return result;
    }

    private boolean isIssueEvent(OperationEventEntity event) {
        String op = event.getOperationType() != null ? event.getOperationType().toUpperCase() : "";
        return ISSUE_OPS.stream().anyMatch(op::contains);
    }

    private boolean isSlottingMaterialType(String materialType) {
        String t = normalizeMaterialType(materialType);
        return "raw_material".equals(t) || "packaging_material".equals(t) || "product".equals(t);
    }

    private String normalizeMaterialType(String materialType) {
        if (materialType == null || materialType.isBlank()) {
            return "raw_material";
        }
        String t = materialType.toLowerCase();
        if (t.equals("packing_material") || t.equals("packaging")) {
            return "packaging_material";
        }
        if (t.equals("product") || t.equals("fg") || t.equals("finished_good")) {
            return "product";
        }
        return "raw_material";
    }

    private record MonthKey(UUID materialId, YearMonth month) {}
    public record AbcFmsClasses(String abc, String fms, String amalgamated) {}
}
