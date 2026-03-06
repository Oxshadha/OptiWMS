package com.optiwms.coreapp.operations;

import com.optiwms.infra.operations.OperationEventEntity;
import com.optiwms.infra.operations.OperationEventRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

@Service
public class OperationEventService {

    private final OperationEventRepository repository;

    public OperationEventService(OperationEventRepository repository) {
        this.repository = repository;
    }

    @Transactional
    public void recordCompleted(OperationEventData data) {
        if (data.workerId() == null) {
            return;
        }
        LocalDateTime completedAt = data.completedAt() != null ? data.completedAt() : LocalDateTime.now();
        Integer duration = null;
        if (data.startedAt() != null) {
            duration = (int) Math.max(0, ChronoUnit.MINUTES.between(data.startedAt(), completedAt));
        }

        OperationEventEntity entity = new OperationEventEntity();
        entity.setOperationType(data.operationType());
        entity.setWorkerId(data.workerId());
        entity.setTaskId(data.taskId());
        entity.setOrderId(data.orderId());
        entity.setOrderItemId(data.orderItemId());
        entity.setWarehouseId(data.warehouseId());
        entity.setMaterialId(data.materialId());
        entity.setQuantity(data.quantity());
        entity.setStartedAt(data.startedAt());
        entity.setCompletedAt(completedAt);
        entity.setDurationMinutes(duration);
        entity.setStatus("completed");
        entity.setMetadata(data.metadata());
        repository.save(entity);
    }

    @Transactional
    public void recordError(OperationEventData data) {
        if (data.workerId() == null) {
            return;
        }
        LocalDateTime occurredAt = data.completedAt() != null ? data.completedAt() : LocalDateTime.now();
        Integer duration = null;
        if (data.startedAt() != null) {
            duration = (int) Math.max(0, ChronoUnit.MINUTES.between(data.startedAt(), occurredAt));
        }

        OperationEventEntity entity = new OperationEventEntity();
        entity.setOperationType(data.operationType());
        entity.setWorkerId(data.workerId());
        entity.setTaskId(data.taskId());
        entity.setOrderId(data.orderId());
        entity.setOrderItemId(data.orderItemId());
        entity.setWarehouseId(data.warehouseId());
        entity.setMaterialId(data.materialId());
        entity.setQuantity(data.quantity());
        entity.setStartedAt(data.startedAt());
        entity.setCompletedAt(occurredAt);
        entity.setDurationMinutes(duration);
        entity.setStatus("error");
        entity.setMetadata(data.metadata());
        repository.save(entity);
    }

    public List<OperationEventEntity> listCompletedSince(LocalDateTime startDate) {
        return repository.findByCompletedAtAfter(startDate);
    }

    public record OperationEventData(
            String operationType,
            UUID workerId,
            UUID taskId,
            UUID orderId,
            UUID orderItemId,
            UUID warehouseId,
            UUID materialId,
            Integer quantity,
            LocalDateTime startedAt,
            LocalDateTime completedAt,
            String metadata
    ) {}
}
