package com.optiwms.coreapi.routing;

import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

@Component
public class RoutingEventStream {
    private static final long STREAM_TIMEOUT_MS = Duration.ofMinutes(30).toMillis();
    private final Map<UUID, CopyOnWriteArrayList<SseEmitter>> emitters = new ConcurrentHashMap<>();

    public SseEmitter subscribe(UUID warehouseId, Object initialSnapshot) {
        SseEmitter emitter = new SseEmitter(STREAM_TIMEOUT_MS);
        CopyOnWriteArrayList<SseEmitter> warehouseEmitters =
                emitters.computeIfAbsent(warehouseId, ignored -> new CopyOnWriteArrayList<>());
        warehouseEmitters.add(emitter);
        emitter.onCompletion(() -> warehouseEmitters.remove(emitter));
        emitter.onTimeout(() -> warehouseEmitters.remove(emitter));
        emitter.onError(error -> warehouseEmitters.remove(emitter));
        try {
            emitter.send(SseEmitter.event()
                    .name("snapshot")
                    .id("0")
                    .data(initialSnapshot));
        } catch (IOException error) {
            warehouseEmitters.remove(emitter);
            emitter.completeWithError(error);
        }
        return emitter;
    }

    public void publish(UUID warehouseId, String eventName, Object payload) {
        List<SseEmitter> warehouseEmitters = emitters.getOrDefault(
                warehouseId,
                new CopyOnWriteArrayList<>()
        );
        for (SseEmitter emitter : warehouseEmitters) {
            try {
                emitter.send(SseEmitter.event()
                        .name(eventName)
                        .data(payload));
            } catch (IOException | IllegalStateException error) {
                warehouseEmitters.remove(emitter);
                emitter.complete();
            }
        }
    }
}
