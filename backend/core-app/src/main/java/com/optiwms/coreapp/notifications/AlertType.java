package com.optiwms.coreapp.notifications;

/**
 * Alert Type enum for warehouse notifications
 */
public enum AlertType {
    // Inventory Alerts
    LOW_STOCK("Low Stock Warning", "inventory"),
    OVERSTOCKED("Overstock Alert", "inventory"),
    SLOW_MOVING("Slow Moving Item", "inventory"),
    FAST_MOVING("High Demand Item", "inventory"),
    EXPIRING_SOON("Item Expiring Soon", "inventory"),
    EXPIRED_ITEMS("Expired Items Detected", "inventory"),
    
    // Operational Alerts
    PICKING_QUEUE("Picking Queue Alert", "operations"),
    PACKING_DELAY("Packing Delay", "operations"),
    RECEIVING_BACKLOG("Receiving Backlog", "operations"),
    CYCLE_COUNT_DUE("Cycle Count Due", "operations"),
    TASK_OVERDUE("Task Overdue", "operations"),
    
    // Path & Congestion Alerts
    CONGESTION_WARNING("Warehouse Congestion", "pathfinding"),
    AISLE_BLOCKED("Aisle Blocked", "pathfinding"),
    ROUTE_OPTIMIZED("Route Optimized", "pathfinding"),
    REROUTE_SUGGESTED("Reroute Suggested", "pathfinding"),
    
    // Order Alerts
    ORDER_READY("Order Ready for Pickup", "orders"),
    ORDER_SHIPPED("Order Shipped", "orders"),
    ORDER_DELAYED("Order Delayed", "orders"),
    CUSTOMER_CHANGE("Customer Request", "orders"),
    DUPLICATE_ORDER("Duplicate Order Detected", "orders"),
    
    // System Alerts
    SYSTEM_ERROR("System Error", "system"),
    SERVICE_DOWN("Service Down", "system"),
    DATABASE_ERROR("Database Error", "system"),
    API_ERROR("API Error", "system"),
    AUTHENTICATION_FAILED("Authentication Failed", "system"),
    
    // Performance Alerts
    SLOT_EFFICIENCY("Slot Efficiency", "performance"),
    WORKER_PRODUCTIVITY("Worker Productivity", "performance"),
    PICKING_ACCURACY("Picking Accuracy Issue", "performance"),
    
    // User Notifications
    PROFILE_UPDATE("Profile Updated", "user"),
    PASSWORD_CHANGED("Password Changed", "user"),
    LOGIN_NOTIFICATION("New Login Detected", "user"),
    SHIFT_REMINDER("Shift Starting", "user");

    private final String displayName;
    private final String category;

    AlertType(String displayName, String category) {
        this.displayName = displayName;
        this.category = category;
    }

    public String getDisplayName() {
        return displayName;
    }

    public String getCategory() {
        return category;
    }
}
