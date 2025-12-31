package com.optiwms.coreapp.notifications;

import com.optiwms.domain.notifications.Notification;
import com.optiwms.infra.notifications.NotificationEntity;
import com.optiwms.infra.notifications.NotificationRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class NotificationService {

    private final NotificationRepository repository;

    public NotificationService(NotificationRepository repository) {
        this.repository = repository;
    }

    public List<Notification> findByUserId(UUID userId) {
        // Get user-specific notifications and broadcast notifications (userId is NULL)
        List<NotificationEntity> userNotifications = repository.findByUserIdOrderByCreatedAtDesc(userId);
        List<NotificationEntity> broadcastNotifications = repository.findByUserIdIsNullOrderByCreatedAtDesc();
        
        // Combine and sort by created_at desc
        List<NotificationEntity> allNotifications = userNotifications.stream()
                .collect(Collectors.toList());
        allNotifications.addAll(broadcastNotifications);
        
        return allNotifications.stream()
                .sorted((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt()))
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    public List<Notification> findByUserIdAndRead(UUID userId, Boolean read) {
        List<NotificationEntity> userNotifications = repository.findByUserIdAndReadOrderByCreatedAtDesc(userId, read);
        List<NotificationEntity> broadcastNotifications = repository.findByUserIdIsNullOrderByCreatedAtDesc();
        
        // Filter broadcast notifications by read status
        List<NotificationEntity> filteredBroadcast = broadcastNotifications.stream()
                .filter(n -> n.getRead().equals(read))
                .collect(Collectors.toList());
        
        List<NotificationEntity> allNotifications = userNotifications.stream()
                .collect(Collectors.toList());
        allNotifications.addAll(filteredBroadcast);
        
        return allNotifications.stream()
                .sorted((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt()))
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    public Long countUnreadByUserId(UUID userId) {
        Long userUnread = repository.countByUserIdAndRead(userId, false);
        Long broadcastUnread = repository.countByUserIdAndRead(null, false);
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
        
        // Also mark broadcast notifications as read for this user (we'll track this in metadata or separate table if needed)
        // For now, we'll just mark user-specific ones
    }

    @Transactional
    public void delete(UUID id) {
        repository.deleteById(id);
    }

    private Notification toDomain(NotificationEntity entity) {
        Notification domain = new Notification();
        domain.setId(entity.getId());
        domain.setUserId(entity.getUserId());
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
        entity.setTitle(domain.getTitle());
        entity.setMessage(domain.getMessage());
        entity.setNotificationType(domain.getNotificationType());
        entity.setRead(domain.getRead());
        entity.setActionUrl(domain.getActionUrl());
        entity.setMetadata(domain.getMetadata());
        entity.setCreatedAt(domain.getCreatedAt());
        return entity;
    }
}

