package com.optiwms.coreapp.orders;

import com.optiwms.coreapp.tasks.TaskService;
import com.optiwms.domain.orders.Order;
import com.optiwms.domain.tasks.Task;
import com.optiwms.infra.orders.OrderItemEntity;
import com.optiwms.infra.orders.OrderItemRepository;
import com.optiwms.coreapp.master.MaterialService;
import com.optiwms.domain.master.Material;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Service for managing inbound order workflow:
 * - Automatic receiving task creation
 * - Status transitions (pending → receiving → received)
 * - Task assignment and locking (first-come-first-serve)
 */
@Service
public class InboundOrderWorkflowService {

    private final OrderService orderService;
    private final TaskService taskService;
    private final OrderItemRepository orderItemRepository;
    private final MaterialService materialService;

    public InboundOrderWorkflowService(
            OrderService orderService,
            TaskService taskService,
            OrderItemRepository orderItemRepository,
            MaterialService materialService) {
        this.orderService = orderService;
        this.taskService = taskService;
        this.orderItemRepository = orderItemRepository;
        this.materialService = materialService;
    }

    /**
     * Create receiving tasks automatically when inbound order is created.
     * Tasks are unassigned (status="pending") for first-come-first-serve.
     */
    @Transactional
    public void createReceivingTasksForOrder(UUID orderId) {
        Order order = orderService.findById(orderId);
        
        if (!"inbound".equals(order.getOrderType())) {
            return; // Only create tasks for inbound orders
        }

        if (order.getWarehouseId() == null) {
            throw new RuntimeException("Order must have a warehouse assigned to create receiving tasks");
        }

        // Get all order items
        List<OrderItemEntity> orderItems = orderItemRepository.findByOrderId(orderId);
        
        if (orderItems.isEmpty()) {
            return; // No items to receive
        }

        // Create receiving task for each order item
        for (OrderItemEntity item : orderItems) {
            // Get material details
            Material material;
            try {
                material = materialService.findById(item.getMaterialId());
            } catch (Exception e) {
                // Material not found - skip this item
                continue;
            }

            Task receivingTask = new Task();
            receivingTask.setTaskNumber(generateTaskNumber("RECV", order.getOrderNumber()));
            receivingTask.setTaskType("receiving");
            receivingTask.setWarehouseId(order.getWarehouseId());
            receivingTask.setAssignedTo(null); // Unassigned - first come first serve
            receivingTask.setPriority(order.getPriority() != null ? order.getPriority() : "normal");
            receivingTask.setStatus("pending");
            receivingTask.setReferenceType("order");
            receivingTask.setReferenceId(orderId);
            receivingTask.setLocationCode(null); // Receiving doesn't need location (items come in)
            receivingTask.setNotes(String.format("Receive %s units of %s", 
                    item.getQuantity(), 
                    material.getMaterialCode() != null ? material.getMaterialCode() : "Item"));
            
            if (order.getExpectedDate() != null) {
                receivingTask.setDueDate(order.getExpectedDate().atStartOfDay());
            } else {
                receivingTask.setDueDate(LocalDateTime.now().plusDays(1));
            }

            taskService.create(receivingTask);
        }

        // Update order status to indicate tasks are ready
        orderService.updateStatus(orderId, "pending");
    }

    /**
     * Generate unique task number
     */
    private String generateTaskNumber(String prefix, String orderNumber) {
        String timestamp = String.valueOf(System.currentTimeMillis());
        return prefix + "-" + orderNumber + "-" + timestamp.substring(timestamp.length() - 6);
    }
}
