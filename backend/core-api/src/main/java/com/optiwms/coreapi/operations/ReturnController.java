package com.optiwms.coreapi.operations;

import com.optiwms.coreapp.operations.ReturnService;
import com.optiwms.domain.operations.ReturnRecord;
import com.optiwms.infra.users.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/returns")
public class ReturnController {

    private final ReturnService service;
    private final UserRepository userRepository;

    public ReturnController(ReturnService service, UserRepository userRepository) {
        this.service = service;
        this.userRepository = userRepository;
    }

    @GetMapping
    public ResponseEntity<List<ReturnDto>> listAll(
            @RequestParam(required = false) String orderId,
            @RequestParam(required = false) String customerId,
            @RequestParam(required = false) String status
    ) {
        List<ReturnRecord> returns;
        if (orderId != null) {
            returns = service.findByOrderId(UUID.fromString(orderId));
        } else if (customerId != null) {
            returns = service.findByCustomerId(UUID.fromString(customerId));
        } else if (status != null) {
            returns = service.findByStatus(status);
        } else {
            returns = service.listAll();
        }

        List<ReturnDto> returnDtos = returns.stream()
                .map(this::toDto)
                .collect(Collectors.toList());
        return ResponseEntity.ok(returnDtos);
    }

    @GetMapping("/{id}")
    public ResponseEntity<ReturnDto> getById(@PathVariable UUID id) {
        ReturnRecord returnRecord = service.findById(id);
        return ResponseEntity.ok(toDto(returnRecord));
    }

    @PostMapping
    public ResponseEntity<ReturnDto> create(@RequestBody CreateReturnRequest request) {
        ReturnRecord returnRecord = new ReturnRecord();
        returnRecord.setReturnNumber(request.returnNumber());
        returnRecord.setOriginalOrderId(request.originalOrderId() != null ? UUID.fromString(request.originalOrderId()) : null);
        returnRecord.setCustomerId(request.customerId() != null ? UUID.fromString(request.customerId()) : null);
        returnRecord.setWarehouseId(request.warehouseId() != null ? UUID.fromString(request.warehouseId()) : null);
        if (request.returnDate() != null && !request.returnDate().isEmpty()) {
            returnRecord.setReturnDate(LocalDate.parse(request.returnDate()));
        } else {
            returnRecord.setReturnDate(LocalDate.now());
        }
        returnRecord.setReason(request.reason());
        returnRecord.setStatus(request.status() != null ? request.status() : "pending");
        returnRecord.setResolution(request.resolution());
        returnRecord.setReceivedBy(request.receivedBy() != null ? UUID.fromString(request.receivedBy()) : null);
        returnRecord.setInspectedBy(request.inspectedBy() != null ? UUID.fromString(request.inspectedBy()) : null);

        ReturnRecord created = service.create(returnRecord);
        return ResponseEntity.status(HttpStatus.CREATED).body(toDto(created));
    }

    @PostMapping("/intake/outbound")
    public ResponseEntity<ReturnDto> intakeOutbound(
            @RequestBody OutboundReturnIntakeRequest request,
            Authentication authentication
    ) {
        UUID workerId = request.workerId() != null
                ? UUID.fromString(request.workerId())
                : resolveActorUserId(authentication);
        ReturnRecord createdOrUpdated = service.intakeOutboundReturn(
                request.orderNumber(),
                request.reason(),
                workerId
        );
        return ResponseEntity.status(HttpStatus.CREATED).body(toDto(createdOrUpdated));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ReturnDto> update(@PathVariable UUID id, @RequestBody UpdateReturnRequest request) {
        ReturnRecord returnRecord = service.findById(id);
        if (request.reason() != null) returnRecord.setReason(request.reason());
        if (request.resolution() != null) returnRecord.setResolution(request.resolution());
        if (request.status() != null) returnRecord.setStatus(request.status());
        if (request.receivedBy() != null) returnRecord.setReceivedBy(UUID.fromString(request.receivedBy()));
        if (request.inspectedBy() != null) returnRecord.setInspectedBy(UUID.fromString(request.inspectedBy()));

        ReturnRecord updated = service.update(returnRecord);
        return ResponseEntity.ok(toDto(updated));
    }

    @PutMapping("/{id}/status")
    public ResponseEntity<ReturnDto> updateStatus(
            @PathVariable UUID id,
            @RequestBody UpdateStatusRequest request,
            Authentication authentication
    ) {
        UUID actor = resolveActorUserId(authentication);
        ReturnRecord updated = service.updateStatus(id, request.status(), actor, request.notes());
        return ResponseEntity.ok(toDto(updated));
    }

    @PutMapping("/{id}/approve")
    public ResponseEntity<ReturnDto> approve(
            @PathVariable UUID id,
            @RequestBody ApproveReturnRequest request,
            Authentication authentication
    ) {
        UUID approvedBy = request.approvedBy() != null
                ? UUID.fromString(request.approvedBy())
                : resolveActorUserId(authentication);
        ReturnRecord updated = service.approve(id, approvedBy);
        return ResponseEntity.ok(toDto(updated));
    }

    @PutMapping("/{id}/inspection")
    public ResponseEntity<ReturnDto> submitInspection(
            @PathVariable UUID id,
            @RequestBody ReturnInspectionRequest request,
            Authentication authentication
    ) {
        UUID inspectedBy = request.inspectedBy() != null
                ? UUID.fromString(request.inspectedBy())
                : resolveActorUserId(authentication);
        ReturnRecord updated = service.submitInspection(id, request.overallResolution(), request.notes(), inspectedBy);
        return ResponseEntity.ok(toDto(updated));
    }

    @PutMapping("/{id}/reject")
    public ResponseEntity<ReturnDto> reject(
            @PathVariable UUID id,
            @RequestBody RejectReturnRequest request,
            Authentication authentication
    ) {
        UUID reviewedBy = request.reviewedBy() != null
                ? UUID.fromString(request.reviewedBy())
                : resolveActorUserId(authentication);
        ReturnRecord updated = service.reject(id, request.rejectionReason(), request.resolution(), reviewedBy);
        return ResponseEntity.ok(toDto(updated));
    }

    @PutMapping("/{id}/assign")
    public ResponseEntity<ReturnDto> assignWorker(
            @PathVariable UUID id,
            @RequestBody AssignReturnWorkerRequest request
    ) {
        ReturnRecord updated = service.assignWorker(id, UUID.fromString(request.workerId()));
        return ResponseEntity.ok(toDto(updated));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        service.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    private ReturnDto toDto(ReturnRecord returnRecord) {
        return new ReturnDto(
                returnRecord.getId().toString(),
                returnRecord.getReturnNumber(),
                returnRecord.getOriginalOrderId() != null ? returnRecord.getOriginalOrderId().toString() : null,
                returnRecord.getCustomerId() != null ? returnRecord.getCustomerId().toString() : null,
                returnRecord.getWarehouseId() != null ? returnRecord.getWarehouseId().toString() : null,
                returnRecord.getReturnDate() != null ? returnRecord.getReturnDate().toString() : null,
                returnRecord.getReason(),
                returnRecord.getStatus(),
                returnRecord.getResolution(),
                returnRecord.getReceivedBy() != null ? returnRecord.getReceivedBy().toString() : null,
                returnRecord.getInspectedBy() != null ? returnRecord.getInspectedBy().toString() : null,
                returnRecord.getReturnFlow(),
                returnRecord.getQcOutcome(),
                returnRecord.getSupplierResponseStatus(),
                returnRecord.getSupplierResponseNotes(),
                returnRecord.getFalseReturnRequest(),
                returnRecord.getCustomerCareFlag(),
                returnRecord.getFollowupOrderId() != null ? returnRecord.getFollowupOrderId().toString() : null,
                returnRecord.getClosedAt() != null ? returnRecord.getClosedAt().toString() : null,
                returnRecord.getLastStatusChangedAt() != null ? returnRecord.getLastStatusChangedAt().toString() : null
        );
    }

    public record CreateReturnRequest(
            String returnNumber,
            String originalOrderId,
            String customerId,
            String warehouseId,
            String returnDate,
            String reason,
            String status,
            String resolution,
            String receivedBy,
            String inspectedBy
    ) {}

    public record UpdateReturnRequest(
            String reason,
            String resolution,
            String status,
            String receivedBy,
            String inspectedBy
    ) {}

    public record UpdateStatusRequest(String status, String notes) {}

    public record ApproveReturnRequest(String approvedBy) {}

    public record ReturnInspectionRequest(
            String overallResolution,
            String notes,
            String inspectedBy
    ) {}

    public record RejectReturnRequest(
            String rejectionReason,
            String resolution,
            String reviewedBy
    ) {}

    public record AssignReturnWorkerRequest(String workerId) {}

    public record OutboundReturnIntakeRequest(
            String orderNumber,
            String reason,
            String workerId
    ) {}

    public record ReturnDto(
            String id,
            String returnNumber,
            String originalOrderId,
            String customerId,
            String warehouseId,
            String returnDate,
            String reason,
            String status,
            String resolution,
            String receivedBy,
            String inspectedBy,
            String returnFlow,
            String qcOutcome,
            String supplierResponseStatus,
            String supplierResponseNotes,
            Boolean falseReturnRequest,
            Boolean customerCareFlag,
            String followupOrderId,
            String closedAt,
            String lastStatusChangedAt
    ) {}

    private UUID resolveActorUserId(Authentication authentication) {
        if (authentication == null || authentication.getName() == null || authentication.getName().isBlank()) {
            return null;
        }
        return userRepository.findByUsername(authentication.getName())
                .map(user -> user.getId())
                .orElse(null);
    }
}
