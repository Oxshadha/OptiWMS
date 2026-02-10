package com.optiwms.coreapp.operations;

import com.optiwms.domain.orders.Order;
import com.optiwms.infra.operations.GrnEntity;
import com.optiwms.infra.operations.GrnRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class GrnService {

    private final GrnRepository repository;

    public GrnService(GrnRepository repository) {
        this.repository = repository;
    }

    @Transactional
    public UUID getOrCreateForOrder(Order order, UUID receivedBy, String notes) {
        return repository.findFirstByPoIdOrderByCreatedAtDesc(order.getId())
                .map(GrnEntity::getId)
                .orElseGet(() -> createForOrder(order, receivedBy, notes).getId());
    }

    public List<GrnEntity> findByOrderId(UUID orderId) {
        return repository.findByPoId(orderId);
    }

    public GrnEntity findById(UUID id) {
        return repository.findById(id).orElseThrow(() -> new RuntimeException("GRN not found: " + id));
    }

    @Transactional
    public void updateStatus(UUID id, String status) {
        GrnEntity grn = findById(id);
        grn.setStatus(status);
        repository.save(grn);
    }

    private GrnEntity createForOrder(Order order, UUID receivedBy, String notes) {
        GrnEntity grn = new GrnEntity();
        grn.setGrnNumber(generateGrnNumber(order.getOrderNumber()));
        grn.setPoId(order.getId());
        grn.setSupplierId(order.getSupplierId());
        grn.setWarehouseId(order.getWarehouseId());
        grn.setReceivedDate(LocalDateTime.now());
        grn.setReceivedBy(receivedBy);
        grn.setStatus("PENDING_QA");
        grn.setNotes(notes);
        return repository.save(grn);
    }

    private String generateGrnNumber(String orderNumber) {
        return "GRN-" + orderNumber + "-" + System.currentTimeMillis();
    }
}
