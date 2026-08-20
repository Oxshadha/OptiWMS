package com.optiwms.coreapp.master;

import com.optiwms.infra.inventory.InventoryItemEntity;
import com.optiwms.infra.master.LocationEntity;
import com.optiwms.infra.master.LocationLevelEntity;
import com.optiwms.infra.master.MaterialEntity;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Locale;

/**
 * Canonical handling-unit rules: 1 bin = 1 pallet/LPN, pallet weight, level-beam limits.
 */
@Service
public class HandlingUnitCapacityService {

    public BigDecimal resolvePalletFootprintSpaces(MaterialEntity material) {
        if (material == null) {
            return BigDecimal.ONE;
        }
        BigDecimal spaces = material.getPalletSpaces();
        if (spaces != null && spaces.compareTo(BigDecimal.ZERO) > 0) {
            return spaces;
        }
        return BigDecimal.ONE;
    }

    public BigDecimal resolveUnitsPerPallet(MaterialEntity material) {
        if (material == null) {
            return BigDecimal.ONE;
        }
        return resolveUnitsPerPallet(material.getUnitsPerPallet(), material.getPalletSpaces());
    }

    /**
     * Value-based overload so callers holding the domain {@code Material} (receiving,
     * putaway) resolve units-per-pallet through the same rules as entity callers.
     */
    public BigDecimal resolveUnitsPerPallet(Integer unitsPerPallet, BigDecimal palletSpaces) {
        if (unitsPerPallet != null && unitsPerPallet > 0) {
            return BigDecimal.valueOf(unitsPerPallet);
        }
        // Legacy records stored unit capacity in pallet_spaces. New records keep
        // pallet footprint and units-per-pallet as separate physical attributes.
        if (palletSpaces != null && palletSpaces.compareTo(BigDecimal.ZERO) > 0) {
            return palletSpaces;
        }
        return BigDecimal.ONE;
    }

    public BigDecimal resolvePalletWeightKg(MaterialEntity material) {
        if (material == null) {
            return BigDecimal.ZERO;
        }
        if (material.getMaxPalletWeightKg() != null
                && material.getMaxPalletWeightKg().compareTo(BigDecimal.ZERO) > 0) {
            return material.getMaxPalletWeightKg();
        }
        BigDecimal unitWeight = material.getWeightKg();
        BigDecimal unitsPerPallet = resolveUnitsPerPallet(material);
        if (unitWeight != null && unitWeight.compareTo(BigDecimal.ZERO) > 0) {
            return unitWeight.multiply(unitsPerPallet);
        }
        return BigDecimal.ZERO;
    }

    public int computePalletCount(int quantity, MaterialEntity material) {
        return computePalletCount(BigDecimal.valueOf(quantity), resolveUnitsPerPallet(material));
    }

    /** Value-based overload: how many pallets (handling units) a quantity occupies. */
    public int computePalletCount(BigDecimal quantity, BigDecimal unitsPerPallet) {
        if (quantity == null || quantity.compareTo(BigDecimal.ZERO) <= 0) {
            return 0;
        }
        BigDecimal perPallet = unitsPerPallet != null && unitsPerPallet.compareTo(BigDecimal.ZERO) > 0
                ? unitsPerPallet
                : BigDecimal.ONE;
        return toPositiveIntCeil(quantity.divide(perPallet, 8, RoundingMode.CEILING));
    }

    public BigDecimal computeBinWeightKg(int quantity, MaterialEntity material) {
        if (quantity <= 0 || material == null) {
            return BigDecimal.ZERO;
        }
        BigDecimal unitWeight = material.getWeightKg();
        if (unitWeight != null && unitWeight.compareTo(BigDecimal.ZERO) > 0) {
            return unitWeight.multiply(BigDecimal.valueOf(quantity));
        }
        int pallets = computePalletCount(quantity, material);
        return resolvePalletWeightKg(material).multiply(BigDecimal.valueOf(pallets));
    }

    public BigDecimal defaultLevelBeamCapacityKg(int levelNumber) {
        int level = levelNumber > 0 ? levelNumber : 3;
        if (level <= 3) {
            return BigDecimal.valueOf(500);
        }
        if (level <= 5) {
            return BigDecimal.valueOf(300);
        }
        return BigDecimal.valueOf(400);
    }

    public BigDecimal resolveLevelBeamCapacityKg(LocationLevelEntity levelEntity, int levelNumber) {
        if (levelEntity != null
                && levelEntity.getWeightCapacityKg() != null
                && levelEntity.getWeightCapacityKg().compareTo(BigDecimal.ZERO) > 0) {
            return levelEntity.getWeightCapacityKg();
        }
        return defaultLevelBeamCapacityKg(levelNumber);
    }

    public int resolveMaxPalletCapacity(LocationEntity location) {
        if (location.getMaxPalletCapacity() != null && location.getMaxPalletCapacity() > 0) {
            return location.getMaxPalletCapacity();
        }
        return 1;
    }

    public boolean palletFitsBin(MaterialEntity material, LocationEntity location) {
        return quantityFitsBin(material, location, resolveUnitsPerPallet(material));
    }

    /**
     * Whether this many units fit the bin's weight and volume limits.
     *
     * Sized to the quantity actually being placed rather than to a full pallet: a bin rated
     * below a full pallet can still carry a partial one, and testing the pallet rating made
     * heavy-pallet SKUs unplaceable in every bin regardless of how little was being received.
     */
    public boolean quantityFitsBin(MaterialEntity material, LocationEntity location, int quantity) {
        return quantityFitsBin(material, location, BigDecimal.valueOf(Math.max(quantity, 0)));
    }

    private boolean quantityFitsBin(MaterialEntity material, LocationEntity location, BigDecimal quantity) {
        if (material == null || quantity == null || quantity.compareTo(BigDecimal.ZERO) <= 0) {
            return true;
        }
        if (location.getMaxWeightKg() != null
                && location.getMaxWeightKg().compareTo(BigDecimal.ZERO) > 0) {
            BigDecimal unitWeight = material.getWeightKg();
            BigDecimal weight = unitWeight != null && unitWeight.compareTo(BigDecimal.ZERO) > 0
                    ? unitWeight.multiply(quantity)
                    : resolvePalletWeightKg(material);
            if (weight.compareTo(location.getMaxWeightKg()) > 0) {
                return false;
            }
        }
        if (material.getVolumeCm3() != null
                && location.getMaxVolumeCm3() != null
                && location.getMaxVolumeCm3().compareTo(BigDecimal.ZERO) > 0) {
            if (material.getVolumeCm3().multiply(quantity).compareTo(location.getMaxVolumeCm3()) > 0) {
                return false;
            }
        }
        return true;
    }

    public boolean canAddPalletToLevelBeam(
            BigDecimal levelUsedKg,
            BigDecimal levelCapacityKg,
            MaterialEntity material) {
        return canAddQuantityToLevelBeam(levelUsedKg, levelCapacityKg, material, resolvePalletWeightKg(material));
    }

    /** Beam headroom for the quantity actually being placed, not for a notional full pallet. */
    public boolean canAddQuantityToLevelBeam(
            BigDecimal levelUsedKg,
            BigDecimal levelCapacityKg,
            MaterialEntity material,
            int quantity) {
        return canAddQuantityToLevelBeam(
                levelUsedKg, levelCapacityKg, material, computeBinWeightKg(quantity, material));
    }

    private boolean canAddQuantityToLevelBeam(
            BigDecimal levelUsedKg,
            BigDecimal levelCapacityKg,
            MaterialEntity material,
            BigDecimal addedWeightKg) {
        if (addedWeightKg == null || addedWeightKg.compareTo(BigDecimal.ZERO) <= 0) {
            return true;
        }
        if (levelCapacityKg == null || levelCapacityKg.compareTo(BigDecimal.ZERO) <= 0) {
            return true;
        }
        return levelUsedKg.add(addedWeightKg).compareTo(levelCapacityKg) <= 0;
    }

    public boolean binHasPalletHeadroom(LocationEntity location, int occupiedPallets) {
        return occupiedPallets < resolveMaxPalletCapacity(location);
    }

    public boolean isBinEmpty(InventoryItemEntity inventory) {
        return inventory == null || inventory.getQuantity() == null || inventory.getQuantity() <= 0;
    }

    public String rackLevelKey(LocationEntity location) {
        return rackLevelKey(
                location.getArea(),
                location.getRowNumber(),
                location.getBayNumber(),
                location.getLevelNumber() != null ? location.getLevelNumber() : 1);
    }

    public String rackLevelKey(String area, String row, String bay, int levelNumber) {
        return normalizeArea(area)
                + "-"
                + normalizeRow(row)
                + "-"
                + normalizeBay(bay)
                + "-L"
                + levelNumber;
    }

    public String rackKey(LocationEntity location) {
        return normalizeArea(location.getArea())
                + "-"
                + normalizeRow(location.getRowNumber())
                + "-"
                + normalizeBay(location.getBayNumber());
    }

    public int proximityScore(LocationEntity a, LocationEntity anchor) {
        if (anchor == null) {
            return 0;
        }
        int rowDiff = Math.abs(parseInt(a.getRowNumber()) - parseInt(anchor.getRowNumber()));
        int bayDiff = Math.abs(parseInt(a.getBayNumber()) - parseInt(anchor.getBayNumber()));
        int levelDiff = Math.abs(
                (a.getLevelNumber() != null ? a.getLevelNumber() : 3)
                        - (anchor.getLevelNumber() != null ? anchor.getLevelNumber() : 3));
        return rowDiff * 100 + bayDiff * 10 + levelDiff;
    }

    private int parseInt(String value) {
        try {
            return Integer.parseInt(value != null ? value.trim() : "0");
        } catch (NumberFormatException ex) {
            return 0;
        }
    }

    private String normalizeArea(String area) {
        String raw = area == null || area.isBlank() ? "C" : area.trim().toUpperCase(Locale.ROOT);
        return "ST".equals(raw) ? "C" : raw;
    }

    private String normalizeRow(String row) {
        int n = parseInt(row);
        if (n <= 0) {
            n = 1;
        }
        return String.format("%02d", n);
    }

    private String normalizeBay(String bay) {
        int n = parseInt(bay);
        if (n <= 0) {
            n = 1;
        }
        return String.format("%03d", n);
    }

    private int toPositiveIntCeil(BigDecimal value) {
        if (value == null || value.compareTo(BigDecimal.ZERO) <= 0) {
            return 0;
        }
        return value.setScale(0, RoundingMode.CEILING).intValue();
    }
}
