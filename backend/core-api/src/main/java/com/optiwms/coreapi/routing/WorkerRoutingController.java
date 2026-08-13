package com.optiwms.coreapi.routing;

import com.optiwms.coreapi.routing.RoutingModels.CreateRouteRequest;
import com.optiwms.coreapi.routing.RoutingModels.RouteProgressRequest;
import com.optiwms.coreapi.routing.RoutingModels.RouteSession;
import com.optiwms.coreapi.routing.RoutingModels.RoutingStats;
import com.optiwms.coreapi.routing.RoutingModels.WarehouseGraph;
import com.optiwms.infra.users.UserEntity;
import com.optiwms.infra.users.UserRepository;
import org.springframework.http.MediaType;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/routing")
public class WorkerRoutingController {
    private final WarehouseRoutingService routingService;
    private final RoutingEventStream eventStream;
    private final UserRepository userRepository;

    public WorkerRoutingController(
            WarehouseRoutingService routingService,
            RoutingEventStream eventStream,
            UserRepository userRepository
    ) {
        this.routingService = routingService;
        this.eventStream = eventStream;
        this.userRepository = userRepository;
    }

    @GetMapping("/graph")
    public ResponseEntity<WarehouseGraph> graph(
            @RequestParam UUID warehouseId,
            @RequestParam(defaultValue = "true") boolean ensure,
            Authentication authentication
    ) {
        requireWarehouseScope(authentication, warehouseId, false);
        WarehouseGraph graph = ensure
                ? routingService.ensureGraph(warehouseId, false)
                : routingService.getGraph(warehouseId);
        return ResponseEntity.ok(graph);
    }

    @PostMapping("/graph/rebuild")
    public ResponseEntity<WarehouseGraph> rebuildGraph(
            @RequestParam UUID warehouseId,
            Authentication authentication
    ) {
        requireWarehouseScope(authentication, warehouseId, true);
        return ResponseEntity.ok(routingService.ensureGraph(warehouseId, true));
    }

    @PostMapping("/sessions")
    public ResponseEntity<RouteSession> createSession(
            @RequestBody CreateRouteRequest request,
            Authentication authentication
    ) {
        UserEntity actor = requireWarehouseScope(
                authentication,
                parseUuid(request.warehouseId(), "warehouseId"),
                false
        );
        UUID requestedWorker = parseUuid(request.workerId(), "workerId");
        if (!isManager(authentication) && !actor.getId().equals(requestedWorker)) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Workers may create routes only for their own account"
            );
        }
        return ResponseEntity.ok(routingService.createRoute(request));
    }

    @GetMapping("/sessions/{sessionId}")
    public ResponseEntity<RouteSession> session(
            @PathVariable UUID sessionId,
            Authentication authentication
    ) {
        RouteSession session = routingService.getSession(sessionId);
        requireSessionScope(authentication, session);
        return ResponseEntity.ok(session);
    }

    @PostMapping("/sessions/{sessionId}/progress")
    public ResponseEntity<RouteSession> progress(
            @PathVariable UUID sessionId,
            @RequestBody RouteProgressRequest request,
            Authentication authentication
    ) {
        requireSessionScope(authentication, routingService.getSession(sessionId));
        return ResponseEntity.ok(routingService.progress(sessionId, request));
    }

    @PostMapping("/sessions/{sessionId}/cancel")
    public ResponseEntity<RouteSession> cancel(
            @PathVariable UUID sessionId,
            @RequestParam(required = false) Integer routeVersion,
            Authentication authentication
    ) {
        requireSessionScope(authentication, routingService.getSession(sessionId));
        return ResponseEntity.ok(routingService.progress(
                sessionId,
                new RouteProgressRequest(
                        routeVersion,
                        "CANCEL",
                        null,
                        null,
                        UUID.randomUUID().toString()
                )
        ));
    }

    @GetMapping("/active")
    public ResponseEntity<List<RouteSession>> active(
            @RequestParam UUID warehouseId,
            Authentication authentication
    ) {
        requireWarehouseScope(authentication, warehouseId, true);
        return ResponseEntity.ok(routingService.activeRoutes(warehouseId));
    }

    @GetMapping("/stats")
    public ResponseEntity<RoutingStats> stats(
            @RequestParam UUID warehouseId,
            Authentication authentication
    ) {
        requireWarehouseScope(authentication, warehouseId, true);
        return ResponseEntity.ok(routingService.stats(warehouseId));
    }

    @GetMapping(
            value = "/events/stream",
            produces = MediaType.TEXT_EVENT_STREAM_VALUE
    )
    public SseEmitter events(
            @RequestParam UUID warehouseId,
            Authentication authentication
    ) {
        requireWarehouseScope(authentication, warehouseId, true);
        return eventStream.subscribe(
                warehouseId,
                routingService.activeRoutes(warehouseId)
        );
    }

    private void requireSessionScope(
            Authentication authentication,
            RouteSession session
    ) {
        UserEntity actor = requireWarehouseScope(
                authentication,
                session.warehouseId(),
                false
        );
        if (!isManager(authentication) && !actor.getId().equals(session.workerId())) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Workers may access only their own route sessions"
            );
        }
    }

    private UserEntity requireWarehouseScope(
            Authentication authentication,
            UUID warehouseId,
            boolean managerRequired
    ) {
        UserEntity actor = resolveActor(authentication);
        boolean manager = isManager(authentication);
        if (managerRequired && !manager) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Warehouse route fleet control requires a manager role"
            );
        }
        boolean unrestrictedAdmin = hasAuthority(authentication, "ROLE_ADMIN");
        if (!unrestrictedAdmin
                && actor.getWarehouseId() != null
                && !actor.getWarehouseId().equals(warehouseId)) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "The requested warehouse is outside the authenticated scope"
            );
        }
        if (!unrestrictedAdmin && actor.getWarehouseId() == null) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "The authenticated user has no warehouse assignment"
            );
        }
        return actor;
    }

    private UserEntity resolveActor(Authentication authentication) {
        if (authentication == null
                || authentication.getName() == null
                || authentication.getName().isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        }
        return userRepository.findByUsername(authentication.getName())
                .or(() -> userRepository.findByEmail(authentication.getName()))
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED,
                        "Authenticated user record not found"
                ));
    }

    private boolean isManager(Authentication authentication) {
        return hasAuthority(authentication, "ROLE_ADMIN")
                || hasAuthority(authentication, "ROLE_WAREHOUSE_MANAGER");
    }

    private boolean hasAuthority(
            Authentication authentication,
            String expected
    ) {
        if (authentication == null || authentication.getAuthorities() == null) {
            return false;
        }
        for (GrantedAuthority authority : authentication.getAuthorities()) {
            if (expected.equals(authority.getAuthority())) return true;
        }
        return false;
    }

    private UUID parseUuid(String value, String field) {
        try {
            return UUID.fromString(value);
        } catch (Exception exception) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    field + " must be a UUID"
            );
        }
    }
}
