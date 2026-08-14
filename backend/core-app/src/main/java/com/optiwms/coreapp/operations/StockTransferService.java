package com.optiwms.coreapp.operations;

import com.optiwms.coreapp.inventory.InventoryService;
import com.optiwms.coreapp.master.MaterialDefaultLocationService;
import com.optiwms.coreapp.tasks.TaskService;
import com.optiwms.domain.inventory.InventoryItem;
import com.optiwms.domain.operations.StockTransfer;
import com.optiwms.domain.operations.StockTransferLine;
import com.optiwms.domain.tasks.Task;
import com.optiwms.infra.operations.StockTransferEntity;
import com.optiwms.infra.operations.StockTransferLineEntity;
import com.optiwms.infra.operations.StockTransferLineEventEntity;
import com.optiwms.infra.operations.StockTransferLineEventRepository;
import com.optiwms.infra.operations.StockTransferLineRepository;
import com.optiwms.infra.operations.StockTransferRepository;
import com.optiwms.infra.intelligence.PlanningCycleRepository;
import com.optiwms.infra.slotting.SlottingPlanEntity;
import com.optiwms.infra.slotting.SlottingPlanLineEntity;
import com.optiwms.infra.slotting.SlottingPlanLineRepository;
import com.optiwms.infra.slotting.SlottingPlanReserveLineEntity;
import com.optiwms.infra.slotting.SlottingPlanReserveLineRepository;
import com.optiwms.infra.slotting.SlottingPlanRepository;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class StockTransferService {

    private static final String TRANSFER_REF_TYPE = "STOCK_TRANSFER_LINE";

    private final StockTransferRepository repository;
    private final StockTransferLineRepository lineRepository;
    private final StockTransferLineEventRepository lineEventRepository;
    private final InventoryService inventoryService;
    private final TaskService taskService;
    private final OperationEventService operationEventService;
    private final SlottingPlanLineRepository slottingPlanLineRepository;
    private final SlottingPlanRepository slottingPlanRepository;
    private final PlanningCycleRepository planningCycleRepository;
    private final MaterialDefaultLocationService defaultLocationService;
    private final SlottingPlanReserveLineRepository slottingReserveLineRepository;

    public StockTransferService(
            StockTransferRepository repository,
            StockTransferLineRepository lineRepository,
            StockTransferLineEventRepository lineEventRepository,
            InventoryService inventoryService,
            TaskService taskService,
            OperationEventService operationEventService,
            SlottingPlanLineRepository slottingPlanLineRepository,
            SlottingPlanRepository slottingPlanRepository,
            PlanningCycleRepository planningCycleRepository,
            MaterialDefaultLocationService defaultLocationService,
            SlottingPlanReserveLineRepository slottingReserveLineRepository
    ) {
        this.repository = repository;
        this.lineRepository = lineRepository;
        this.lineEventRepository = lineEventRepository;
        this.inventoryService = inventoryService;
        this.taskService = taskService;
        this.operationEventService = operationEventService;
        this.slottingPlanLineRepository = slottingPlanLineRepository;
        this.slottingPlanRepository = slottingPlanRepository;
        this.planningCycleRepository = planningCycleRepository;
        this.defaultLocationService = defaultLocationService;
        this.slottingReserveLineRepository = slottingReserveLineRepository;
    }

    public List<StockTransfer> listAll() {
        return repository.findAll().stream()
                .map(this::toDomainWithLines)
                .collect(Collectors.toList());
    }

    public List<StockTransfer> findByStatus(String status) {
        return repository.findByStatus(status).stream()
                .map(this::toDomainWithLines)
                .collect(Collectors.toList());
    }

    public Page<StockTransfer> findPaged(
            UUID warehouseId,
            String status,
            String transferType,
            String query,
            Pageable pageable
    ) {
        Specification<StockTransferEntity> spec = (root, cq, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (warehouseId != null) {
                predicates.add(cb.or(
                        cb.equal(root.get("sourceWarehouseId"), warehouseId),
                        cb.equal(root.get("destWarehouseId"), warehouseId)
                ));
            }
            if (status != null && !status.isBlank()) {
                predicates.add(cb.equal(root.get("status"), status));
            }
            if (transferType != null && !transferType.isBlank()) {
                predicates.add(cb.equal(root.get("transferType"), transferType));
            }
            if (query != null && !query.isBlank()) {
                String pattern = "%" + query.toLowerCase() + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("transferNumber")), pattern),
                        cb.like(cb.lower(root.get("sourceLocationCode")), pattern),
                        cb.like(cb.lower(root.get("destLocationCode")), pattern),
                        cb.like(cb.lower(root.get("status")), pattern),
                        cb.like(cb.lower(root.get("notes")), pattern)
                ));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
        return repository.findAll(spec, pageable).map(this::toDomainWithLines);
    }

    public StockTransfer findById(UUID id) {
        StockTransferEntity entity = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Stock transfer not found: " + id));
        return toDomainWithLines(entity);
    }

    public List<StockTransferLine> findLinesByTransfer(UUID transferId) {
        return lineRepository.findByTransferIdOrderByLineNumberAsc(transferId).stream()
                .map(this::toLineDomain)
                .collect(Collectors.toList());
    }

    public List<StockTransferLine> findExecutableLines(UUID workerId, UUID warehouseId) {
        List<String> openStatuses = List.of("open", "in_progress", "partial");
        List<StockTransferLineEntity> allOpenLines = lineRepository.findByStatusIn(openStatuses);

        return allOpenLines.stream()
                .filter(line -> {
                    if (line.getAssignedWorkerId() != null && !line.getAssignedWorkerId().equals(workerId)) {
                        return false;
                    }
                    return warehouseId == null || warehouseId.equals(line.getSourceWarehouseId());
                })
                .sorted(Comparator.comparing(StockTransferLineEntity::getCreatedAt))
                .map(this::toLineDomain)
                .collect(Collectors.toList());
    }

    @Transactional
    public StockTransfer create(StockTransfer transfer) {
        StockTransferEntity savedTransfer = saveTransferHeader(transfer);

        List<StockTransferLine> lines = transfer.getLines();
        if (lines == null || lines.isEmpty()) {
            StockTransferLine singleLine = new StockTransferLine();
            singleLine.setTransferId(savedTransfer.getId());
            singleLine.setLineNumber(1);
            singleLine.setMaterialId(transfer.getMaterialId());
            singleLine.setSourceWarehouseId(transfer.getSourceWarehouseId());
            singleLine.setSourceLocationCode(transfer.getSourceLocationCode());
            singleLine.setDestWarehouseId(transfer.getDestWarehouseId());
            singleLine.setDestLocationCode(transfer.getDestLocationCode());
            singleLine.setRequestedQuantity(transfer.getQuantity());
            singleLine.setMovedQuantity(0);
            singleLine.setStatus("open");
            singleLine.setAssignedWorkerId(null);
            singleLine.setNotes(transfer.getNotes());
            saveLine(singleLine);
        } else {
            int lineNumber = 1;
            for (StockTransferLine line : lines) {
                line.setTransferId(savedTransfer.getId());
                line.setLineNumber(line.getLineNumber() != null ? line.getLineNumber() : lineNumber);
                line.setMovedQuantity(line.getMovedQuantity() != null ? line.getMovedQuantity() : 0);
                line.setStatus(line.getStatus() != null ? line.getStatus() : "open");
                saveLine(line);
                lineNumber++;
            }
        }

        return findById(savedTransfer.getId());
    }

    @Transactional
    public StockTransfer releaseForSlotting(UUID transferId) {
        return release(transferId, null);
    }

    @Transactional
    public StockTransfer release(UUID transferId, UUID managerId) {
        StockTransferEntity transfer = repository.findById(transferId)
                .orElseThrow(() -> new RuntimeException("Stock transfer not found: " + transferId));

        if (!"draft".equals(transfer.getStatus())) {
            throw new RuntimeException("Only draft transfer orders can be released");
        }

        List<StockTransferLineEntity> lines = lineRepository.findByTransferIdOrderByLineNumberAsc(transferId);
        if (lines.isEmpty()) {
            throw new RuntimeException("Transfer has no lines");
        }

        for (StockTransferLineEntity line : lines) {
            if (line.getRequestedQuantity() == null || line.getRequestedQuantity() <= 0) {
                throw new RuntimeException("Line requested quantity must be greater than 0");
            }
            if (line.getMaterialId() == null || line.getSourceWarehouseId() == null || line.getDestWarehouseId() == null) {
                throw new RuntimeException("Line is missing required material/warehouse fields");
            }
            validateSourceAvailability(line, line.getRequestedQuantity() - safe(line.getMovedQuantity()));

            line.setStatus("open");
            lineRepository.save(line);
            ensureLineTask(line);
        }

        transfer.setStatus("released");
        transfer.setReleasedBy(managerId);
        transfer.setReleasedAt(LocalDateTime.now());
        repository.save(transfer);
        return findById(transferId);
    }

    @Transactional
    public StockTransferLine assignLine(UUID lineId, UUID workerId, String assignedBy) {
        StockTransferLineEntity line = lineRepository.findById(lineId)
                .orElseThrow(() -> new RuntimeException("Stock transfer line not found: " + lineId));
        line.setAssignedWorkerId(workerId);
        if ("open".equals(line.getStatus())) {
            line.setStatus("in_progress");
        }
        line = lineRepository.save(line);
        syncSlottingExecution(line);

        Task task = findLineTask(line.getId());
        if (task != null) {
            taskService.assignTask(task.getId(), workerId, assignedBy);
            taskService.updateStatus(task.getId(), "assigned");
        }
        appendLineEvent(line.getId(), "ASSIGNED", workerId, 0, null, null, "Assigned by " + assignedBy);
        return toLineDomain(line);
    }

    @Transactional
    public StockTransferLine executeLine(UUID lineId, UUID workerId, String sourceScanLocation, String destScanLocation, Integer quantity, String notes) {
        if (quantity == null || quantity <= 0) {
            throw new RuntimeException("Quantity must be greater than 0");
        }

        StockTransferLineEntity line = lineRepository.findById(lineId)
                .orElseThrow(() -> new RuntimeException("Stock transfer line not found: " + lineId));

        if ("completed".equals(line.getStatus()) || "cancelled".equals(line.getStatus())) {
            throw new RuntimeException("Line is already completed/cancelled");
        }

        if (line.getAssignedWorkerId() != null && !line.getAssignedWorkerId().equals(workerId)) {
            throw new RuntimeException("Line is assigned to another worker");
        }

        if (line.getSourceLocationCode() != null && sourceScanLocation != null
                && !line.getSourceLocationCode().equalsIgnoreCase(sourceScanLocation.trim())) {
            throw new RuntimeException("Source scan location does not match transfer line source location");
        }

        if (line.getDestLocationCode() != null && destScanLocation != null
                && !line.getDestLocationCode().equalsIgnoreCase(destScanLocation.trim())) {
            throw new RuntimeException("Destination scan location does not match transfer line destination location");
        }

        int alreadyMoved = safe(line.getMovedQuantity());
        int remaining = line.getRequestedQuantity() - alreadyMoved;
        if (quantity > remaining) {
            throw new RuntimeException("Quantity exceeds remaining transfer quantity. Remaining: " + remaining);
        }

        applyInventoryMove(line, quantity);

        int newMoved = alreadyMoved + quantity;
        line.setMovedQuantity(newMoved);
        line.setAssignedWorkerId(workerId);
        line.setStatus(newMoved >= line.getRequestedQuantity() ? "completed" : "partial");
        line = lineRepository.save(line);
        syncSlottingExecution(line);

        Task task = findLineTask(line.getId());
        if (task != null) {
            if ("completed".equals(line.getStatus())) {
                taskService.updateStatusWithWorker(task.getId(), "completed", workerId);
            } else {
                taskService.updateStatusWithWorker(task.getId(), "in_progress", workerId);
            }
        }

        appendLineEvent(
                line.getId(),
                "MOVE_CONFIRMED",
                workerId,
                quantity,
                sourceScanLocation != null ? sourceScanLocation : line.getSourceLocationCode(),
                destScanLocation != null ? destScanLocation : line.getDestLocationCode(),
                notes
        );

        updateTransferStatus(line.getTransferId());

        operationEventService.recordCompleted(new OperationEventService.OperationEventData(
                "STOCK_TRANSFER_MOVE",
                workerId,
                null,
                null,
                null,
                line.getSourceWarehouseId(),
                line.getMaterialId(),
                quantity,
                null,
                LocalDateTime.now(),
                "transferId=" + line.getTransferId() + ";lineId=" + line.getId()
        ));

        return toLineDomain(line);
    }

    @Transactional
    public StockTransferLine skipLine(UUID lineId, UUID workerId, String reason) {
        if (reason == null || reason.isBlank()) {
            throw new RuntimeException("Skip reason is required");
        }
        StockTransferLineEntity line = lineRepository.findById(lineId)
                .orElseThrow(() -> new RuntimeException("Stock transfer line not found: " + lineId));

        line.setStatus("blocked");
        line = lineRepository.save(line);
        syncSlottingExecution(line);

        Task task = findLineTask(line.getId());
        if (task != null) {
            taskService.updateStatus(task.getId(), "blocked");
            taskService.updateNotes(task.getId(), reason);
        }

        appendLineEvent(line.getId(), "SKIPPED", workerId, 0, null, null, reason);
        updateTransferStatus(line.getTransferId());
        return toLineDomain(line);
    }

    @Transactional
    public StockTransfer dispatch(UUID id, UUID userId) {
        // Backward compatibility endpoint; maps to release for old clients.
        StockTransfer transfer = release(id, userId);
        StockTransferEntity entity = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Stock transfer not found: " + id));
        if ("released".equals(entity.getStatus())) {
            entity.setStatus("in_transit");
            repository.save(entity);
        }
        return findById(id);
    }

    @Transactional
    public StockTransfer receive(UUID id, UUID userId) {
        // Backward compatibility for single-line transfer API.
        List<StockTransferLineEntity> lines = lineRepository.findByTransferIdOrderByLineNumberAsc(id);
        if (lines.isEmpty()) {
            throw new RuntimeException("Stock transfer has no lines");
        }

        StockTransferLineEntity line = lines.get(0);
        int remaining = line.getRequestedQuantity() - safe(line.getMovedQuantity());
        if (remaining > 0) {
            executeLine(line.getId(), userId, line.getSourceLocationCode(), line.getDestLocationCode(), remaining, "Legacy receive endpoint");
        }

        StockTransferEntity entity = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Stock transfer not found: " + id));
        entity.setStatus("received");
        entity.setReceivedBy(userId);
        entity.setReceivedAt(LocalDateTime.now());
        repository.save(entity);
        return findById(id);
    }

    @Transactional
    public StockTransfer cancel(UUID id, String reason) {
        StockTransferEntity entity = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Stock transfer not found: " + id));

        String currentStatus = entity.getStatus();
        if (!"draft".equals(currentStatus) && !"released".equals(currentStatus) && !"in_progress".equals(currentStatus)
                && !"partially_completed".equals(currentStatus) && !"in_transit".equals(currentStatus)) {
            throw new RuntimeException("Transfer cannot be canceled from status: " + currentStatus);
        }

        for (StockTransferLineEntity line : lineRepository.findByTransferIdOrderByLineNumberAsc(id)) {
            if (!"completed".equals(line.getStatus())) {
                line.setStatus("cancelled");
                line = lineRepository.save(line);
                syncSlottingExecution(line);
            }
            Task task = findLineTask(line.getId());
            if (task != null && !"completed".equals(task.getStatus())) {
                taskService.updateStatus(task.getId(), "cancelled");
            }
        }

        entity.setStatus("cancelled");
        if (reason != null && !reason.isBlank()) {
            String existingNotes = entity.getNotes() != null ? entity.getNotes() : "";
            String separator = existingNotes.isBlank() ? "" : "\n";
            entity.setNotes(existingNotes + separator + "Cancel reason: " + reason.trim());
        }

        StockTransferEntity saved = repository.save(entity);
        return toDomainWithLines(saved);
    }

    private StockTransferEntity saveTransferHeader(StockTransfer transfer) {
        StockTransferEntity entity = new StockTransferEntity();
        entity.setTransferNumber(
                transfer.getTransferNumber() != null && !transfer.getTransferNumber().isBlank()
                        ? transfer.getTransferNumber()
                        : generateTransferNumber()
        );
        entity.setTransferType(transfer.getTransferType() != null ? transfer.getTransferType() : "intra_warehouse");
        entity.setPlanningCycleId(transfer.getPlanningCycleId());
        entity.setMaterialId(transfer.getMaterialId());
        entity.setSourceWarehouseId(transfer.getSourceWarehouseId());
        entity.setSourceLocationCode(transfer.getSourceLocationCode());
        entity.setDestWarehouseId(transfer.getDestWarehouseId());
        entity.setDestLocationCode(transfer.getDestLocationCode());
        entity.setQuantity(transfer.getQuantity() != null ? transfer.getQuantity() : 0);
        entity.setStatus(transfer.getStatus() != null ? transfer.getStatus() : "draft");
        entity.setNotes(transfer.getNotes());
        entity.setCreatedBy(transfer.getCreatedBy());
        return repository.save(entity);
    }

    private StockTransferLineEntity saveLine(StockTransferLine line) {
        StockTransferLineEntity entity = new StockTransferLineEntity();
        entity.setTransferId(line.getTransferId());
        entity.setLineNumber(line.getLineNumber());
        entity.setMaterialId(line.getMaterialId());
        entity.setSourceWarehouseId(line.getSourceWarehouseId());
        entity.setSourceLocationCode(line.getSourceLocationCode());
        entity.setDestWarehouseId(line.getDestWarehouseId());
        entity.setDestLocationCode(line.getDestLocationCode());
        entity.setRequestedQuantity(line.getRequestedQuantity());
        entity.setMovedQuantity(line.getMovedQuantity() != null ? line.getMovedQuantity() : 0);
        entity.setStatus(line.getStatus() != null ? line.getStatus() : "open");
        entity.setAssignedWorkerId(line.getAssignedWorkerId());
        entity.setPlanningCycleId(line.getPlanningCycleId());
        entity.setSlottingPlanLineId(line.getSlottingPlanLineId());
        entity.setNotes(line.getNotes());
        return lineRepository.save(entity);
    }

    private void validateSourceAvailability(StockTransferLineEntity line, int requestedMoveQty) {
        List<InventoryItem> sourceInventory = inventoryService.findByMaterialWarehouseAndLocation(
                line.getMaterialId(),
                line.getSourceWarehouseId(),
                line.getSourceLocationCode()
        );
        if (sourceInventory.isEmpty()) {
            throw new RuntimeException("Source inventory not found for material at location " + line.getSourceLocationCode());
        }
        InventoryItem sourceItem = sourceInventory.get(0);
        int available = safe(sourceItem.getAvailableQuantity());
        if (available < requestedMoveQty) {
            throw new RuntimeException("Insufficient source inventory. Available=" + available + ", required=" + requestedMoveQty);
        }
    }

    private void applyInventoryMove(StockTransferLineEntity line, int quantity) {
        List<InventoryItem> sourceInventory = inventoryService.findByMaterialWarehouseAndLocation(
                line.getMaterialId(),
                line.getSourceWarehouseId(),
                line.getSourceLocationCode()
        );
        if (sourceInventory.isEmpty()) {
            throw new RuntimeException("Source inventory not found for material at source location");
        }

        InventoryItem sourceItem = sourceInventory.get(0);
        int sourceQty = safe(sourceItem.getQuantity());
        int sourceAvailable = safe(sourceItem.getAvailableQuantity());
        if (sourceAvailable < quantity || sourceQty < quantity) {
            throw new RuntimeException("Insufficient quantity in source location");
        }
        sourceItem.setQuantity(sourceQty - quantity);
        sourceItem.setAvailableQuantity(sourceAvailable - quantity);
        inventoryService.update(sourceItem.getId(), sourceItem);

        List<InventoryItem> destinationInventory = inventoryService.findByMaterialWarehouseAndLocation(
                line.getMaterialId(),
                line.getDestWarehouseId(),
                line.getDestLocationCode()
        );

        if (destinationInventory.isEmpty()) {
            InventoryItem newItem = new InventoryItem();
            newItem.setMaterialId(line.getMaterialId());
            newItem.setWarehouseId(line.getDestWarehouseId());
            newItem.setLocationCode(line.getDestLocationCode());
            newItem.setQuantity(quantity);
            newItem.setAvailableQuantity(quantity);
            newItem.setReservedQuantity(0);
            newItem.setStatus("active");
            inventoryService.createNew(newItem);
        } else {
            InventoryItem destinationItem = destinationInventory.get(0);
            destinationItem.setQuantity(safe(destinationItem.getQuantity()) + quantity);
            destinationItem.setAvailableQuantity(safe(destinationItem.getAvailableQuantity()) + quantity);
            inventoryService.update(destinationItem.getId(), destinationItem);
        }
    }

    private void ensureLineTask(StockTransferLineEntity line) {
        if (findLineTask(line.getId()) != null) {
            return;
        }
        Task task = new Task();
        task.setTaskNumber("TT-" + System.currentTimeMillis() + "-" + line.getLineNumber());
        task.setTaskType("stock_transfer");
        task.setWarehouseId(line.getSourceWarehouseId());
        task.setAssignedTo(line.getAssignedWorkerId());
        task.setPriority("normal");
        task.setStatus(line.getAssignedWorkerId() != null ? "assigned" : "pending");
        task.setLocationCode(line.getSourceLocationCode());
        task.setReferenceType(TRANSFER_REF_TYPE);
        task.setReferenceId(line.getId());
        task.setNotes("Transfer line " + line.getLineNumber() + ": move " + line.getRequestedQuantity() + " units to " + line.getDestLocationCode());
        taskService.create(task);
    }

    private Task findLineTask(UUID lineId) {
        List<Task> tasks = taskService.findByReference(TRANSFER_REF_TYPE, lineId);
        return tasks.isEmpty() ? null : tasks.get(0);
    }

    private void appendLineEvent(UUID lineId, String eventType, UUID workerId, Integer quantity, String sourceLocation, String destLocation, String notes) {
        StockTransferLineEventEntity event = new StockTransferLineEventEntity();
        event.setTransferLineId(lineId);
        event.setEventType(eventType);
        event.setWorkerId(workerId);
        event.setQuantity(quantity);
        event.setSourceScanLocation(sourceLocation);
        event.setDestScanLocation(destLocation);
        event.setNotes(notes);
        lineEventRepository.save(event);
    }

    private void updateTransferStatus(UUID transferId) {
        StockTransferEntity transfer = repository.findById(transferId)
                .orElseThrow(() -> new RuntimeException("Stock transfer not found: " + transferId));
        if ("cancelled".equals(transfer.getStatus())) {
            return;
        }

        List<StockTransferLineEntity> lines = lineRepository.findByTransferIdOrderByLineNumberAsc(transferId);
        boolean allCompleted = !lines.isEmpty() && lines.stream().allMatch(l -> "completed".equals(l.getStatus()));
        boolean anyMoved = lines.stream().anyMatch(l -> safe(l.getMovedQuantity()) > 0);
        boolean anyInProgress = lines.stream().anyMatch(l -> "in_progress".equals(l.getStatus()) || "partial".equals(l.getStatus()));

        if (allCompleted) {
            transfer.setStatus("completed");
            transfer.setReceivedAt(LocalDateTime.now());
        } else if (anyMoved) {
            transfer.setStatus("partially_completed");
        } else if (anyInProgress) {
            transfer.setStatus("in_progress");
        } else if (!"draft".equals(transfer.getStatus())) {
            transfer.setStatus("released");
        }
        repository.save(transfer);
    }

    private String generateTransferNumber() {
        return "TF-" + System.currentTimeMillis();
    }

    private int safe(Integer value) {
        return value == null ? 0 : value;
    }

    private StockTransfer toDomainWithLines(StockTransferEntity entity) {
        StockTransfer transfer = toDomain(entity);
        List<StockTransferLine> lines = lineRepository.findByTransferIdOrderByLineNumberAsc(entity.getId()).stream()
                .map(this::toLineDomain)
                .collect(Collectors.toList());
        transfer.setLines(lines);

        if (!lines.isEmpty()) {
            // Backward compatible summary fields for legacy frontend.
            StockTransferLine firstLine = lines.get(0);
            transfer.setMaterialId(firstLine.getMaterialId());
            transfer.setSourceWarehouseId(firstLine.getSourceWarehouseId());
            transfer.setSourceLocationCode(firstLine.getSourceLocationCode());
            transfer.setDestWarehouseId(firstLine.getDestWarehouseId());
            transfer.setDestLocationCode(firstLine.getDestLocationCode());
            transfer.setQuantity(lines.stream().mapToInt(l -> l.getRequestedQuantity() != null ? l.getRequestedQuantity() : 0).sum());
        }

        return transfer;
    }

    private StockTransfer toDomain(StockTransferEntity entity) {
        StockTransfer transfer = new StockTransfer();
        transfer.setId(entity.getId());
        transfer.setTransferNumber(entity.getTransferNumber());
        transfer.setTransferType(entity.getTransferType());
        transfer.setPlanningCycleId(entity.getPlanningCycleId());
        transfer.setMaterialId(entity.getMaterialId());
        transfer.setSourceWarehouseId(entity.getSourceWarehouseId());
        transfer.setSourceLocationCode(entity.getSourceLocationCode());
        transfer.setDestWarehouseId(entity.getDestWarehouseId());
        transfer.setDestLocationCode(entity.getDestLocationCode());
        transfer.setQuantity(entity.getQuantity());
        transfer.setStatus(entity.getStatus());
        transfer.setNotes(entity.getNotes());
        transfer.setCreatedBy(entity.getCreatedBy());
        transfer.setReleasedBy(entity.getReleasedBy());
        transfer.setReleasedAt(entity.getReleasedAt());
        transfer.setDispatchedBy(entity.getDispatchedBy());
        transfer.setDispatchedAt(entity.getDispatchedAt());
        transfer.setReceivedBy(entity.getReceivedBy());
        transfer.setReceivedAt(entity.getReceivedAt());
        return transfer;
    }

    private StockTransferLine toLineDomain(StockTransferLineEntity entity) {
        StockTransferLine line = new StockTransferLine();
        line.setId(entity.getId());
        line.setTransferId(entity.getTransferId());
        line.setLineNumber(entity.getLineNumber());
        line.setMaterialId(entity.getMaterialId());
        line.setSourceWarehouseId(entity.getSourceWarehouseId());
        line.setSourceLocationCode(entity.getSourceLocationCode());
        line.setDestWarehouseId(entity.getDestWarehouseId());
        line.setDestLocationCode(entity.getDestLocationCode());
        line.setRequestedQuantity(entity.getRequestedQuantity());
        line.setMovedQuantity(entity.getMovedQuantity());
        line.setStatus(entity.getStatus());
        line.setAssignedWorkerId(entity.getAssignedWorkerId());
        line.setPlanningCycleId(entity.getPlanningCycleId());
        line.setSlottingPlanLineId(entity.getSlottingPlanLineId());
        line.setNotes(entity.getNotes());
        return line;
    }

    private void syncSlottingExecution(StockTransferLineEntity transferLine) {
        if (transferLine.getSlottingPlanLineId() == null) {
            return;
        }
        SlottingPlanLineEntity slottingLine = slottingPlanLineRepository
                .findById(transferLine.getSlottingPlanLineId()).orElse(null);
        if (slottingLine == null) {
            return;
        }

        if ("completed".equals(transferLine.getStatus())) {
            slottingLine.setStatus("APPLIED");
            slottingLine.setRelocationApplied(true);
            applyCompletedSlottingDefaults(transferLine, slottingLine);
        } else if ("blocked".equals(transferLine.getStatus()) || "cancelled".equals(transferLine.getStatus())) {
            slottingLine.setStatus("EXCEPTION");
            slottingLine.setRelocationApplied(false);
        } else {
            slottingLine.setStatus("IN_PROGRESS");
        }
        slottingPlanLineRepository.save(slottingLine);

        SlottingPlanEntity plan = slottingPlanRepository.findById(slottingLine.getPlanId()).orElse(null);
        if (plan == null) {
            return;
        }
        List<SlottingPlanLineEntity> planLines = slottingPlanLineRepository
                .findByPlanIdOrderByMaterialCodeAsc(plan.getId());
        List<SlottingPlanLineEntity> moves = planLines.stream()
                .filter(line -> Boolean.TRUE.equals(line.getRelocationFlag()))
                .toList();
        boolean complete = !moves.isEmpty() && moves.stream().allMatch(line -> "APPLIED".equals(line.getStatus()));
        boolean exception = moves.stream().anyMatch(line -> "EXCEPTION".equals(line.getStatus()));
        long completedMoves = moves.stream().filter(line -> "APPLIED".equals(line.getStatus())).count();

        plan.setRelocationMovesApplied(Math.toIntExact(completedMoves));
        plan.setConfirmedDistanceSavedMeters(moves.stream()
                .filter(line -> "APPLIED".equals(line.getStatus()))
                .map(SlottingPlanLineEntity::getDistanceSavedMeters)
                .filter(java.util.Objects::nonNull)
                .reduce(java.math.BigDecimal.ZERO, java.math.BigDecimal::add));
        plan.setExecutionStatus(complete ? "COMPLETED" : exception ? "EXCEPTION" : "IN_PROGRESS");
        slottingPlanRepository.save(plan);

        if (plan.getPlanningCycleId() != null) {
            planningCycleRepository.findById(plan.getPlanningCycleId()).ifPresent(cycle -> {
                cycle.setLifecycleStatus(complete ? "COMPLETED" : exception ? "IN_EXECUTION" : "IN_EXECUTION");
                if (complete) cycle.setCompletedAt(java.time.OffsetDateTime.now());
                planningCycleRepository.save(cycle);
            });
        }
    }

    private void applyCompletedSlottingDefaults(
            StockTransferLineEntity transferLine,
            SlottingPlanLineEntity slottingLine) {
        defaultLocationService.assignDefaultLocation(
                slottingLine.getMaterialId(),
                transferLine.getDestWarehouseId(),
                transferLine.getDestLocationCode(),
                1,
                slottingLine.getMaterialType(),
                false);
        int priority = 2;
        for (SlottingPlanReserveLineEntity reserve : slottingReserveLineRepository
                .findByPlanLineIdOrderBySequenceNoAsc(slottingLine.getId())) {
            String reserveCode = reserve.getFinalReserveLocationCode() != null
                    ? reserve.getFinalReserveLocationCode()
                    : reserve.getRecommendedReserveLocationCode();
            if (reserveCode != null) {
                defaultLocationService.assignDefaultLocation(
                        slottingLine.getMaterialId(),
                        transferLine.getDestWarehouseId(),
                        reserveCode,
                        priority++,
                        slottingLine.getMaterialType(),
                        false);
            }
        }
    }
}
