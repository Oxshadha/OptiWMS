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
            @RequestParam(required = false) String userId,
            @RequestParam(required = false) Boolean read
    ) {
        try {
            List<Notification> notifications;
            if (userId != null) {
                if (read != null) {
                    notifications = service.findByUserIdAndRead(UUID.fromString(userId), read);
                } else {
                    notifications = service.findByUserId(UUID.fromString(userId));
                }
            } else {
                return ResponseEntity.badRequest().build();
            }

            List<NotificationDto> dtos = notifications.stream()
                    .map(this::toDto)
                    .collect(Collectors.toList());
            return ResponseEntity.ok(dtos);
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @GetMapping("/unread-count")
    public ResponseEntity<UnreadCountDto> getUnreadCount(@RequestParam String userId) {
        try {
            Long count = service.countUnreadByUserId(UUID.fromString(userId));
            return ResponseEntity.ok(new UnreadCountDto(count));
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PostMapping
    public ResponseEntity<NotificationDto> create(@RequestBody CreateNotificationRequest request) {
        try {
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
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PutMapping("/{id}/read")
    public ResponseEntity<NotificationDto> markAsRead(@PathVariable UUID id) {
        try {
            Notification notification = service.markAsRead(id);
            return ResponseEntity.ok(toDto(notification));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PutMapping("/mark-all-read")
    public ResponseEntity<Void> markAllAsRead(@RequestParam String userId) {
        try {
            service.markAllAsRead(UUID.fromString(userId));
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        try {
            service.delete(id);
            return ResponseEntity.noContent().build();
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
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

