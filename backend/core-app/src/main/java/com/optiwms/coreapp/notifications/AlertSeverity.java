package com.optiwms.coreapp.notifications;

/**
 * Alert Severity levels for notifications
 */
public enum AlertSeverity {
    INFO(0, "Information"),
    WARNING(1, "Warning"),
    CRITICAL(2, "Critical"),
    URGENT(3, "Urgent");

    private final int level;
    private final String displayName;

    AlertSeverity(int level, String displayName) {
        this.level = level;
        this.displayName = displayName;
    }

    public int getLevel() {
        return level;
    }

    public String getDisplayName() {
        return displayName;
    }

    public static AlertSeverity fromLevel(int level) {
        return switch (level) {
            case 0 -> INFO;
            case 1 -> WARNING;
            case 2 -> CRITICAL;
            case 3 -> URGENT;
            default -> INFO;
        };
    }
}
