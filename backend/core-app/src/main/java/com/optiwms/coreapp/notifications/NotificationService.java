package com.optiwms.coreapp.notifications;

import com.optiwms.domain.notifications.Notification;
import com.optiwms.infra.notifications.NotificationEntity;
import com.optiwms.infra.notifications.NotificationRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class NotificationService {

    private final NotificationRepository repository;

    public NotificationService(NotificationRepository repository) {
        this.repository = repository;
    }

    public List<Notification> findByUserId(UUID userId, String role, UUID warehouseId) {
        // Get user-specific notifications and broadcast notifications (userId is NULL)
        List<NotificationEntity> userNotifications = repository.findByUserIdOrderByCreatedAtDesc(userId);
        List<NotificationEntity> broadcastNotifications = repository.findByUserIdIsNullOrderByCreatedAtDesc();
        
        // Combine and sort by created_at desc
        List<NotificationEntity> allNotifications = userNotifications.stream()
                .collect(Collectors.toList());
        allNotifications.addAll(
                broadcastNotifications.stream()
                        .filter(notification -> matchesAudience(notification, role, warehouseId))
                        .toList()
        );
        
        return allNotifications.stream()
                .sorted((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt()))
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    public List<Notification> findByUserIdAndRead(UUID userId, Boolean read, String role, UUID warehouseId) {
        List<NotificationEntity> userNotifications = repository.findByUserIdAndReadOrderByCreatedAtDesc(userId, read);
        List<NotificationEntity> broadcastNotifications = repository.findByUserIdIsNullOrderByCreatedAtDesc();
        
        // Filter broadcast notifications by read status
        List<NotificationEntity> filteredBroadcast = broadcastNotifications.stream()
                .filter(n -> n.getRead().equals(read))
                .filter(n -> matchesAudience(n, role, warehouseId))
                .collect(Collectors.toList());
        
        List<NotificationEntity> allNotifications = userNotifications.stream()
                .collect(Collectors.toList());
        allNotifications.addAll(filteredBroadcast);
        
        return allNotifications.stream()
                .sorted((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt()))
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    public Long countUnreadByUserId(UUID userId, String role, UUID warehouseId) {
        Long userUnread = repository.countByUserIdAndRead(userId, false);
        Long broadcastUnread = repository.findByUserIdIsNullOrderByCreatedAtDesc().stream()
                .filter(n -> Boolean.FALSE.equals(n.getRead()))
                .filter(n -> matchesAudience(n, role, warehouseId))
                .count();
        return (userUnread != null ? userUnread : 0L) + (broadcastUnread != null ? broadcastUnread : 0L);
    }

    @Transactional
    public Notification create(Notification notification) {
        NotificationEntity entity = toEntity(notification);
        return toDomain(repository.save(entity));
    }

    @Transactional
    public Notification markAsRead(UUID id) {
        NotificationEntity entity = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Notification not found: " + id));
        entity.setRead(true);
        return toDomain(repository.save(entity));
    }

    @Transactional
    public void markAllAsRead(UUID userId) {
        List<NotificationEntity> userNotifications = repository.findByUserIdAndReadOrderByCreatedAtDesc(userId, false);
        userNotifications.forEach(n -> n.setRead(true));
        repository.saveAll(userNotifications);
        
        // Also mark broadcast notifications as read since individual markAsRead does this
        List<NotificationEntity> broadcastNotifications = repository.findByUserIdIsNullOrderByCreatedAtDesc()
                .stream()
                .filter(n -> Boolean.FALSE.equals(n.getRead()))
                .collect(Collectors.toList());
        broadcastNotifications.forEach(n -> n.setRead(true));
        repository.saveAll(broadcastNotifications);
    }

    @Transactional
    public void delete(UUID id) {
        repository.deleteById(id);
    }

    private Notification toDomain(NotificationEntity entity) {
        Notification domain = new Notification();
        domain.setId(entity.getId());
        domain.setUserId(entity.getUserId());
        domain.setAudienceRoles(entity.getAudienceRoles());
        domain.setWarehouseId(entity.getWarehouseId());
        domain.setTitle(entity.getTitle());
        domain.setMessage(entity.getMessage());
        domain.setNotificationType(entity.getNotificationType());
        domain.setRead(entity.getRead());
        domain.setActionUrl(entity.getActionUrl());
        domain.setMetadata(entity.getMetadata());
        domain.setCreatedAt(entity.getCreatedAt());
        return domain;
    }

    private NotificationEntity toEntity(Notification domain) {
        NotificationEntity entity = new NotificationEntity();
        entity.setId(domain.getId());
        entity.setUserId(domain.getUserId());
        entity.setAudienceRoles(domain.getAudienceRoles());
        entity.setWarehouseId(domain.getWarehouseId());
        entity.setTitle(domain.getTitle());
        entity.setMessage(domain.getMessage());
        entity.setNotificationType(domain.getNotificationType());
        entity.setRead(domain.getRead());
        entity.setActionUrl(domain.getActionUrl());
        entity.setMetadata(domain.getMetadata());
        entity.setCreatedAt(domain.getCreatedAt());
        return entity;
    }

    private boolean matchesAudience(NotificationEntity entity, String role, UUID warehouseId) {
        return matchesRole(entity.getAudienceRoles(), role) && matchesWarehouse(entity.getWarehouseId(), warehouseId);
    }

    private boolean matchesRole(String audienceRoles, String role) {
        if (audienceRoles == null || audienceRoles.isBlank()) {
            return true;
        }
        if (role == null || role.isBlank()) {
            return false;
        }

        Set<String> allowedRoles = Arrays.stream(audienceRoles.split(","))
                .map(String::trim)
                .filter(value -> !value.isBlank())
                .map(value -> value.toLowerCase(Locale.ROOT))
                .collect(Collectors.toSet());

        String normalizedRole = role.trim().toLowerCase(Locale.ROOT);
        if (allowedRoles.contains(normalizedRole)) {
            return true;
        }

        // Support broad worker targeting while keeping exact admin-role targeting.
        return allowedRoles.contains("worker")
                && !"admin".equals(normalizedRole)
                && !"warehouse_manager".equals(normalizedRole)
                && !"inbound_coordinator".equals(normalizedRole);
    }

    private boolean matchesWarehouse(UUID targetWarehouseId, UUID warehouseId) {
        return targetWarehouseId == null || (warehouseId != null && targetWarehouseId.equals(warehouseId));
    }
}
