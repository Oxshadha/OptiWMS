package com.optiwms.coreapi.notifications;

import com.optiwms.coreapp.notifications.NotificationService;
import com.optiwms.domain.notifications.Notification;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    private final NotificationService service;

    public NotificationController(NotificationService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<List<NotificationDto>> getAll(
            @RequestParam String userId,
            @RequestParam(required = false) Boolean read
    ) {
        List<Notification> notifications;
        if (read != null) {
            notifications = service.findByUserIdAndRead(UUID.fromString(userId), read);
        } else {
            notifications = service.findByUserId(UUID.fromString(userId));
        }

        List<NotificationDto> dtos = notifications.stream()
                .map(this::toDto)
                .collect(Collectors.toList());
        return ResponseEntity.ok(dtos);
    }

    @GetMapping("/unread-count")
    public ResponseEntity<UnreadCountDto> getUnreadCount(@RequestParam String userId) {
        Long count = service.countUnreadByUserId(UUID.fromString(userId));
        return ResponseEntity.ok(new UnreadCountDto(count));
    }

    @PostMapping
    public ResponseEntity<NotificationDto> create(@RequestBody CreateNotificationRequest request) {
        Notification notification = new Notification();
        notification.setUserId(request.userId() != null ? UUID.fromString(request.userId()) : null);
        notification.setTitle(request.title());
        notification.setMessage(request.message());
        notification.setNotificationType(request.notificationType());
        notification.setActionUrl(request.actionUrl());
        notification.setMetadata(request.metadata());
        notification.setRead(false);
        notification.setCreatedAt(OffsetDateTime.now());

        Notification created = service.create(notification);
        return ResponseEntity.status(HttpStatus.CREATED).body(toDto(created));
    }

    @PutMapping("/{id}/read")
    public ResponseEntity<NotificationDto> markAsRead(@PathVariable UUID id) {
        Notification notification = service.markAsRead(id);
        return ResponseEntity.ok(toDto(notification));
    }

    @PutMapping("/mark-all-read")
    public ResponseEntity<Void> markAllAsRead(@RequestParam String userId) {
        service.markAllAsRead(UUID.fromString(userId));
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }

    private NotificationDto toDto(Notification notification) {
        return new NotificationDto(
                notification.getId().toString(),
                notification.getUserId() != null ? notification.getUserId().toString() : null,
                notification.getTitle(),
                notification.getMessage(),
                notification.getNotificationType(),
                notification.getRead(),
                notification.getActionUrl(),
                notification.getMetadata(),
                notification.getCreatedAt() != null ? notification.getCreatedAt().toString() : null
        );
    }

    public record CreateNotificationRequest(
            String userId, // null for broadcast
            String title,
            String message,
            String notificationType,
            String actionUrl,
            String metadata // JSON string
    ) {}

    public record NotificationDto(
            String id,
            String userId,
            String title,
            String message,
            String notificationType,
            Boolean read,
            String actionUrl,
            String metadata,
            String createdAt
    ) {}

    public record UnreadCountDto(Long count) {}
}
