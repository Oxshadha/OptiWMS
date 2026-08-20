package com.optiwms.coreapi.routing;

import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

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
        } catch (Exception error) {
            warehouseEmitters.remove(emitter);
            try {
                emitter.completeWithError(error);
            } catch (Exception ignored) {
                // Subscriber vanished mid-handshake; nothing left to tell.
            }
        }
        return emitter;
    }

    /**
     * Push an event to every subscriber, never failing the caller.
     *
     * Publishing happens on the request thread that changed the route, so anything thrown here
     * becomes the response to that request. A browser that had already navigated away left a
     * dead emitter behind, and tidying it up threw again from inside the catch -- Tomcat rejects
     * touching an AsyncContext after its error listener has run. The worker asking for a route
     * got that servlet error back instead of their route, for a failure that belonged entirely
     * to somebody else's disconnected tab.
     */
    public void publish(UUID warehouseId, String eventName, Object payload) {
        List<SseEmitter> warehouseEmitters = emitters.get(warehouseId);
        if (warehouseEmitters == null || warehouseEmitters.isEmpty()) {
            return;
        }
        for (SseEmitter emitter : warehouseEmitters) {
            try {
                emitter.send(SseEmitter.event()
                        .name(eventName)
                        .data(payload));
            } catch (Exception error) {
                warehouseEmitters.remove(emitter);
                discard(emitter);
            }
        }
    }

    /** Close a broken emitter. It is already unreachable, so failing to close it changes nothing. */
    private void discard(SseEmitter emitter) {
        try {
            emitter.complete();
        } catch (Exception ignored) {
            // The container has already torn this request down.
        }
    }
}
