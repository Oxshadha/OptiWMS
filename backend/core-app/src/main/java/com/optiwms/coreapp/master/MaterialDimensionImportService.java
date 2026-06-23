package com.optiwms.coreapp.master;

import com.optiwms.infra.master.MaterialEntity;
import com.optiwms.infra.master.MaterialRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class MaterialDimensionImportService {

    private final MaterialRepository materialRepository;

    public MaterialDimensionImportService(MaterialRepository materialRepository) {
        this.materialRepository = materialRepository;
    }

    @Transactional
    public ImportResult importCsv(InputStream inputStream) throws IOException {
        int updated = 0;
        int skipped = 0;
        int errors = 0;
        List<String> errorMessages = new ArrayList<>();

        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(inputStream, StandardCharsets.UTF_8))) {
            String headerLine = reader.readLine();
            if (headerLine == null) {
                return new ImportResult(0, 0, 1, "Empty file", List.of("CSV header missing"));
            }
            Map<String, Integer> headerIndex = parseHeader(headerLine);
            if (!headerIndex.containsKey("material_code")) {
                return new ImportResult(0, 0, 1, "Invalid header",
                        List.of("Required column: material_code"));
            }

            String line;
            int rowNum = 1;
            while ((line = reader.readLine()) != null) {
                rowNum++;
                if (line.isBlank()) {
                    continue;
                }
                try {
                    String[] cols = splitCsvLine(line);
                    String code = getColumn(cols, headerIndex, "material_code");
                    if (code == null || code.isBlank()) {
                        skipped++;
                        continue;
                    }
                    Optional<MaterialEntity> entityOpt = materialRepository.findByMaterialCode(code.trim());
                    if (entityOpt.isEmpty()) {
                        skipped++;
                        continue;
                    }
                    MaterialEntity entity = entityOpt.get();
                    entity.setLengthCm(parseDecimal(getColumn(cols, headerIndex, "length_cm")));
                    entity.setWidthCm(parseDecimal(getColumn(cols, headerIndex, "width_cm")));
                    entity.setHeightCm(parseDecimal(getColumn(cols, headerIndex, "height_cm")));
                    entity.setWeightKg(parseDecimal(getColumn(cols, headerIndex, "weight_kg")));

                    String palletRaw = getColumn(cols, headerIndex, "pallet_spaces");
                    if (palletRaw == null || palletRaw.isBlank()) {
                        palletRaw = getColumn(cols, headerIndex, "units_per_pallet");
                    }
                    entity.setPalletSpaces(parseDecimal(palletRaw));

                    BigDecimal l = entity.getLengthCm();
                    BigDecimal w = entity.getWidthCm();
                    BigDecimal h = entity.getHeightCm();
                    if (l != null && w != null && h != null) {
                        entity.setVolumeCm3(l.multiply(w).multiply(h));
                    } else {
                        entity.setVolumeCm3(parseDecimal(getColumn(cols, headerIndex, "volume_cm3")));
                    }

                    materialRepository.save(entity);
                    updated++;
                } catch (Exception e) {
                    errors++;
                    errorMessages.add("Row " + rowNum + ": " + e.getMessage());
                }
            }
        }

        String message = String.format("Updated %d materials, skipped %d, errors %d", updated, skipped, errors);
        return new ImportResult(updated, skipped, errors, message, errorMessages);
    }

    private Map<String, Integer> parseHeader(String headerLine) {
        Map<String, Integer> index = new HashMap<>();
        String[] parts = splitCsvLine(headerLine);
        for (int i = 0; i < parts.length; i++) {
            index.put(parts[i].trim().toLowerCase(), i);
        }
        return index;
    }

    private String[] splitCsvLine(String line) {
        return line.split(",(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)", -1);
    }

    private String getColumn(String[] cols, Map<String, Integer> headerIndex, String name) {
        Integer idx = headerIndex.get(name.toLowerCase());
        if (idx == null || idx >= cols.length) {
            return null;
        }
        return cols[idx].trim().replace("\"", "");
    }

    private BigDecimal parseDecimal(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        return new BigDecimal(raw.trim());
    }

    public record ImportResult(
            int updated,
            int skipped,
            int errors,
            String message,
            List<String> errorDetails) {}
}
