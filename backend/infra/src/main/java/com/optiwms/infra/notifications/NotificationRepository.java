package com.optiwms.infra.notifications;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface NotificationRepository extends JpaRepository<NotificationEntity, UUID> {
    List<NotificationEntity> findByUserIdOrderByCreatedAtDesc(UUID userId);
    List<NotificationEntity> findByUserIdAndReadOrderByCreatedAtDesc(UUID userId, Boolean read);
    List<NotificationEntity> findByUserIdIsNullOrderByCreatedAtDesc(); // Broadcast notifications
    List<NotificationEntity> findByNotificationTypeOrderByCreatedAtDesc(String notificationType);
    Long countByUserIdAndRead(UUID userId, Boolean read);
}

