package com.optiwms.coreapp.slotting;

import com.optiwms.coreapp.master.MaterialDefaultLocationService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * Runs a default-location assignment in its own transaction so a rejected one cannot cancel the
 * release around it.
 *
 * <p>{@code assignDefaultLocation} validates the target bin and throws when it is unusable -- a
 * contested primary, a non-storage location, a blocked rack. Those refusals are individually
 * correct, but the call is {@code @Transactional}, so throwing inside a slotting release marked the
 * surrounding transaction rollback-only. Catching the exception at the call site was not enough:
 * Spring still refused the commit with {@code UnexpectedRollbackException}, and all 34 pallet moves
 * were lost to one stale default.
 *
 * <p>A separate bean is required rather than a method on the caller, because self-invocation does
 * not pass through the proxy that applies the propagation setting.
 */
@Service
public class DefaultLocationAssignmentIsolation {

    private final MaterialDefaultLocationService defaultLocationService;

    public DefaultLocationAssignmentIsolation(MaterialDefaultLocationService defaultLocationService) {
        this.defaultLocationService = defaultLocationService;
    }

    /**
     * @throws RuntimeException when the bin is rejected; the caller decides whether that is fatal.
     *         Only this inner transaction rolls back.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void assign(
            UUID materialId, UUID warehouseId, String locationCode, int priority, String materialType) {
        defaultLocationService.assignDefaultLocation(
                materialId, warehouseId, locationCode, priority, materialType, false);
    }
}
