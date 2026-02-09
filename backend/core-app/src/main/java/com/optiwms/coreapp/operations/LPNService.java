package com.optiwms.coreapp.operations;

import com.optiwms.infra.operations.LPNEntity;
import com.optiwms.infra.operations.LPNRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Service for managing License Plate Numbers (LPNs)
 * LPNs track physical pallets/containers in the warehouse
 */
@Service
public class LPNService {

    private final LPNRepository repository;

    public LPNService(LPNRepository repository) {
        this.repository = repository;
    }

    /**
     * Generate a new LPN code
     * Format: LPN-XXXX where XXXX is sequential number
     */
    public String generateLPNCode() {
        // Get the most recently created LPN
        Pageable pageable = PageRequest.of(0, 100); // Get top 100 to find highest number
        List<LPNEntity> recentLPNs = repository.findAllByOrderByCreatedAtDesc(pageable);
        
        int nextNumber = 1;
        if (!recentLPNs.isEmpty()) {
            // Find the highest number
            for (LPNEntity lpn : recentLPNs) {
                String code = lpn.getLpnCode();
                if (code != null && code.startsWith("LPN-")) {
                    try {
                        String numberPart = code.substring(4); // Skip "LPN-"
                        int num = Integer.parseInt(numberPart);
                        if (num >= nextNumber) {
                            nextNumber = num + 1;
                        }
                    } catch (NumberFormatException e) {
                        // Skip non-numeric LPNs
                    }
                }
            }
        }
        
        // Format as LPN-XXXX (4 digits minimum, pad with zeros)
        return String.format("LPN-%04d", nextNumber);
    }

    /**
     * Create a new LPN record
     */
    @Transactional
    public LPNEntity createLPN(
            String lpnCode,
            UUID materialId,
            UUID warehouseId,
            String locationCode,
            Integer quantity,
            UUID createdBy) {
        
        // Check if LPN already exists
        if (repository.findByLpnCode(lpnCode).isPresent()) {
            throw new RuntimeException("LPN already exists: " + lpnCode);
        }
        
        LPNEntity entity = new LPNEntity();
        entity.setLpnCode(lpnCode);
        entity.setMaterialId(materialId);
        entity.setWarehouseId(warehouseId);
        entity.setLocationCode(locationCode);
        entity.setQuantity(quantity != null ? quantity : 0);
        entity.setStatus("active");
        entity.setCreatedBy(createdBy);
        entity.setCreatedAt(OffsetDateTime.now());
        entity.setUpdatedAt(OffsetDateTime.now());
        
        return repository.save(entity);
    }

    /**
     * Find LPN by code
     */
    public Optional<LPNEntity> findByCode(String lpnCode) {
        return repository.findByLpnCode(lpnCode);
    }

    /**
     * Update LPN location (when putaway completes)
     */
    @Transactional
    public LPNEntity updateLPNLocation(String lpnCode, String locationCode) {
        LPNEntity lpn = repository.findByLpnCode(lpnCode)
                .orElseThrow(() -> new RuntimeException("LPN not found: " + lpnCode));
        
        lpn.setLocationCode(locationCode);
        lpn.setUpdatedAt(OffsetDateTime.now());
        
        return repository.save(lpn);
    }

    /**
     * Update LPN status
     */
    @Transactional
    public LPNEntity updateLPNStatus(String lpnCode, String status) {
        LPNEntity lpn = repository.findByLpnCode(lpnCode)
                .orElseThrow(() -> new RuntimeException("LPN not found: " + lpnCode));
        
        lpn.setStatus(status);
        lpn.setUpdatedAt(OffsetDateTime.now());
        
        return repository.save(lpn);
    }
}
