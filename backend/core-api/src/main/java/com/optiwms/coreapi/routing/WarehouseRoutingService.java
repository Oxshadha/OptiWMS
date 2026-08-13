package com.optiwms.coreapi.routing;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.optiwms.coreapi.routing.RoutingModels.Coordinate;
import com.optiwms.coreapi.routing.RoutingModels.CreateRouteRequest;
import com.optiwms.coreapi.routing.RoutingModels.GraphEdge;
import com.optiwms.coreapi.routing.RoutingModels.GraphNode;
import com.optiwms.coreapi.routing.RoutingModels.RackFootprint;
import com.optiwms.coreapi.routing.RoutingModels.RouteLeg;
import com.optiwms.coreapi.routing.RoutingModels.RouteProgressRequest;
import com.optiwms.coreapi.routing.RoutingModels.RouteSession;
import com.optiwms.coreapi.routing.RoutingModels.RouteStop;
import com.optiwms.coreapi.routing.RoutingModels.RoutingStats;
import com.optiwms.coreapi.routing.RoutingModels.WarehouseGraph;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.PriorityQueue;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class WarehouseRoutingService {
    private static final double DEFAULT_SPEED_MPS = 1.5;
    private static final double RACK_HALF_WIDTH_M = 2.0;
    private static final double RACK_DEPTH_M = 4.0;
    private static final double SAFETY_HEADWAY_SECONDS = 3.0;
    private static final Duration ROUTE_LEASE = Duration.ofMinutes(5);
    private static final String ACTIVE = "ACTIVE";

    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;
    private final RoutingEventStream eventStream;

    public WarehouseRoutingService(
            JdbcTemplate jdbc,
            ObjectMapper objectMapper,
            RoutingEventStream eventStream
    ) {
        this.jdbc = jdbc;
        this.objectMapper = objectMapper;
        this.eventStream = eventStream;
    }

    @Transactional
    public WarehouseGraph ensureGraph(UUID warehouseId, boolean rebuild) {
        lockWarehouseRouting(warehouseId);
        String datasetVersion = jdbc.query(
                """
                SELECT dataset_version
                  FROM warehouses
                 WHERE id = ?
                   AND LOWER(COALESCE(status, '')) = 'active'
                """,
                rs -> rs.next() ? rs.getString(1) : null,
                warehouseId
        );
        if (datasetVersion == null || datasetVersion.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Active warehouse or dataset version not found"
            );
        }

        Optional<UUID> activeGraph = activeGraphId(warehouseId);
        if (activeGraph.isPresent() && !rebuild) {
            return loadGraph(activeGraph.get());
        }
        if (rebuild) {
            Integer activeSessions = jdbc.queryForObject("""
                    SELECT COUNT(*)
                      FROM worker_route_sessions
                     WHERE warehouse_id = ?
                       AND status IN ('PLANNED', 'ACTIVE', 'WAITING')
                       AND lease_expires_at > NOW()
                    """, Integer.class, warehouseId);
            if (activeSessions != null && activeSessions > 0) {
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "Finish or cancel active worker routes before rebuilding the graph"
                );
            }
        }

        List<DbLocation> locations = jdbc.query("""
                SELECT location_code, area, row_number, bay_number,
                       location_type, zone_type,
                       coordinate_x, coordinate_y
                  FROM locations
                 WHERE warehouse_id = ?
                   AND is_active = TRUE
                   AND dataset_version = ?
                   AND coordinate_x IS NOT NULL
                   AND coordinate_y IS NOT NULL
                 ORDER BY location_code
                """, DB_LOCATION_MAPPER, warehouseId, datasetVersion);
        if (locations.isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "The active warehouse dataset has no routable coordinates"
            );
        }

        BuiltGraph built = buildGraph(datasetVersion, locations);
        String graphHash = hashGraph(built);
        Optional<UUID> existingHashGraph = jdbc.query(
                """
                SELECT id
                  FROM warehouse_route_graphs
                 WHERE warehouse_id = ? AND graph_hash = ?
                 ORDER BY generated_at DESC
                 LIMIT 1
                """,
                rs -> rs.next() ? Optional.of((UUID) rs.getObject(1)) : Optional.empty(),
                warehouseId,
                graphHash
        );

        jdbc.update("""
                UPDATE warehouse_route_graphs
                   SET status = 'RETIRED', retired_at = NOW()
                 WHERE warehouse_id = ? AND status = 'ACTIVE'
                """, warehouseId);

        UUID graphId;
        if (existingHashGraph.isPresent()) {
            graphId = existingHashGraph.get();
            jdbc.update("""
                    UPDATE warehouse_route_graphs
                       SET status = 'ACTIVE', retired_at = NULL, generated_at = NOW()
                     WHERE id = ?
                    """, graphId);
        } else {
            graphId = UUID.randomUUID();
            jdbc.update("""
                    INSERT INTO warehouse_route_graphs(
                        id, warehouse_id, dataset_version, layout_version,
                        graph_hash, status, node_count, edge_count,
                        rack_footprint_count
                    ) VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?)
                    """,
                    graphId,
                    warehouseId,
                    datasetVersion,
                    built.layoutVersion(),
                    graphHash,
                    built.nodes().size(),
                    built.edges().size(),
                    built.racks().size()
            );
            persistGraph(graphId, built);
        }

        appendEvent(
                null,
                warehouseId,
                null,
                "GRAPH_ACTIVATED",
                null,
                null,
                null,
                Map.of(
                        "graphId", graphId.toString(),
                        "graphHash", graphHash,
                        "datasetVersion", datasetVersion,
                        "nodes", built.nodes().size(),
                        "edges", built.edges().size(),
                        "racks", built.racks().size()
                )
        );
        WarehouseGraph response = loadGraph(graphId);
        eventStream.publish(warehouseId, "graph", response);
        return response;
    }

    public WarehouseGraph getGraph(UUID warehouseId) {
        UUID graphId = activeGraphId(warehouseId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "No active route graph for this warehouse"
                ));
        return loadGraph(graphId);
    }

    @Transactional
    public RouteSession createRoute(CreateRouteRequest request) {
        UUID warehouseId = parseUuid(request.warehouseId(), "warehouseId");
        UUID workerId = parseUuid(request.workerId(), "workerId");
        UUID taskId = nullableUuid(request.taskId(), "taskId");
        UUID orderId = nullableUuid(request.orderId(), "orderId");
        String operation = normalizeOperation(request.operationType());
        String vehicle = normalizeVehicle(request.vehicleType());

        if (request.locationCodes() == null || request.locationCodes().isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "At least one destination location is required"
            );
        }
        lockWarehouseRouting(warehouseId);
        ensureWorkerAndTaskScope(workerId, taskId, warehouseId);
        expireLeases();

        WarehouseGraph graphResponse = ensureGraph(warehouseId, false);
        GraphData graph = graphData(graphResponse.graphId());
        String startNode = resolveStartNode(
                graph,
                operation,
                request.startNodeId()
        );
        String endNode = resolveEndNode(
                graph,
                operation,
                request.endNodeId()
        );

        List<OrderedStop> orderedStops = orderStops(
                graph,
                startNode,
                request.locationCodes()
        );
        UUID sessionId = UUID.randomUUID();
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);

        jdbc.update("""
                INSERT INTO worker_route_sessions(
                    id, warehouse_id, graph_id, task_id, order_id, worker_id,
                    operation_type, vehicle_type, status, route_version,
                    start_node_id, current_node_id, end_node_id,
                    lease_expires_at, started_at, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', 1, ?, ?, ?, ?, ?, ?, ?)
                """,
                sessionId,
                warehouseId,
                graphResponse.graphId(),
                taskId,
                orderId,
                workerId,
                operation,
                vehicle,
                startNode,
                startNode,
                endNode,
                now.plus(ROUTE_LEASE),
                now,
                now,
                now
        );

        for (int index = 0; index < orderedStops.size(); index++) {
            OrderedStop stop = orderedStops.get(index);
            jdbc.update("""
                    INSERT INTO worker_route_stops(
                        id, session_id, sequence_no, location_code,
                        access_node_id, status
                    ) VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    UUID.randomUUID(),
                    sessionId,
                    index + 1,
                    stop.locationCode(),
                    stop.accessNodeId(),
                    index == 0 ? "CURRENT" : "PENDING"
            );
        }

        List<String> waypointNodes = orderedStops.stream()
                .map(OrderedStop::accessNodeId)
                .collect(Collectors.toCollection(ArrayList::new));
        if (endNode != null && !endNode.equals(waypointNodes.isEmpty()
                ? startNode
                : waypointNodes.get(waypointNodes.size() - 1))) {
            waypointNodes.add(endNode);
        }

        PlannedRoute planned = planWaypoints(
                graph,
                startNode,
                waypointNodes,
                now,
                null,
                vehicle
        );
        persistPlan(sessionId, 1, planned);
        updateSessionMetrics(sessionId, planned, now);
        appendEvent(
                sessionId,
                warehouseId,
                workerId,
                "ROUTE_CREATED",
                startNode,
                null,
                1,
                Map.of(
                        "operationType", operation,
                        "vehicleType", vehicle,
                        "stopCount", orderedStops.size(),
                        "clientStatus", "ACTIVE"
                )
        );

        RouteSession response = getSession(sessionId);
        eventStream.publish(warehouseId, "route", response);
        return response;
    }

    public RouteSession getSession(UUID sessionId) {
        SessionRow session = sessionRow(sessionId, false);
        List<RouteStop> stops = jdbc.query("""
                SELECT id, sequence_no, location_code, access_node_id,
                       status, completed_at
                  FROM worker_route_stops
                 WHERE session_id = ?
                 ORDER BY sequence_no
                """, (rs, rowNum) -> new RouteStop(
                (UUID) rs.getObject("id"),
                rs.getInt("sequence_no"),
                rs.getString("location_code"),
                rs.getString("access_node_id"),
                rs.getString("status"),
                rs.getObject("completed_at", OffsetDateTime.class)
        ), sessionId);

        List<RouteLeg> legs = jdbc.query("""
                SELECT r.sequence_no, e.edge_id, r.from_node_id, r.to_node_id,
                       r.reserved_from, r.reserved_until, r.status,
                       fn.coordinate_x AS from_x, fn.coordinate_y AS from_y,
                       tn.coordinate_x AS to_x, tn.coordinate_y AS to_y,
                       e.distance_m
                  FROM worker_route_reservations r
                  JOIN warehouse_route_nodes fn
                    ON fn.graph_id = ? AND fn.node_id = r.from_node_id
                  JOIN warehouse_route_nodes tn
                    ON tn.graph_id = ? AND tn.node_id = r.to_node_id
                  JOIN warehouse_route_edges e
                    ON e.graph_id = ?
                   AND e.from_node_id = r.from_node_id
                   AND e.to_node_id = r.to_node_id
                 WHERE r.session_id = ?
                   AND r.route_version = ?
                   AND r.resource_type = 'EDGE'
                 ORDER BY r.sequence_no
                """, (rs, rowNum) -> {
            OffsetDateTime from = rs.getObject("reserved_from", OffsetDateTime.class);
            OffsetDateTime until = rs.getObject("reserved_until", OffsetDateTime.class);
            double travelSeconds = rs.getBigDecimal("distance_m").doubleValue()
                    / speedFor(session.vehicleType());
            double reservedSeconds = Duration.between(from, until).toMillis() / 1000.0;
            return new RouteLeg(
                    rs.getInt("sequence_no"),
                    rs.getString("edge_id"),
                    rs.getString("from_node_id"),
                    rs.getString("to_node_id"),
                    new Coordinate(
                            rs.getBigDecimal("from_x").doubleValue(),
                            rs.getBigDecimal("from_y").doubleValue()
                    ),
                    new Coordinate(
                            rs.getBigDecimal("to_x").doubleValue(),
                            rs.getBigDecimal("to_y").doubleValue()
                    ),
                    from,
                    until,
                    rs.getBigDecimal("distance_m").doubleValue(),
                    Math.max(0, reservedSeconds - travelSeconds),
                    rs.getString("status")
            );
        },
                session.graphId(),
                session.graphId(),
                session.graphId(),
                sessionId,
                session.routeVersion()
        );

        return new RouteSession(
                session.id(),
                session.warehouseId(),
                session.graphId(),
                session.workerId(),
                session.taskId(),
                session.orderId(),
                session.operationType(),
                session.vehicleType(),
                session.status(),
                session.routeVersion(),
                session.startNodeId(),
                session.currentNodeId(),
                session.endNodeId(),
                session.totalDistanceM(),
                session.estimatedTravelSeconds(),
                session.totalWaitSeconds(),
                session.leaseExpiresAt(),
                session.updatedAt(),
                stops,
                legs
        );
    }

    public List<RouteSession> activeRoutes(UUID warehouseId) {
        expireLeases();
        List<UUID> ids = jdbc.query("""
                SELECT id
                  FROM worker_route_sessions
                 WHERE warehouse_id = ?
                   AND status IN ('PLANNED', 'ACTIVE', 'WAITING')
                   AND lease_expires_at > NOW()
                 ORDER BY updated_at DESC
                """, (rs, rowNum) -> (UUID) rs.getObject(1), warehouseId);
        return ids.stream().map(this::getSession).toList();
    }

    @Transactional
    public RouteSession progress(UUID sessionId, RouteProgressRequest request) {
        SessionRow session = sessionRow(sessionId, true);
        lockWarehouseRouting(session.warehouseId());
        if (!Set.of("ACTIVE", "WAITING", "PLANNED").contains(session.status())) {
            return getSession(sessionId);
        }
        if (request.routeVersion() != null
                && request.routeVersion() != session.routeVersion()) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Stale route version; refresh the active route before confirming progress"
            );
        }
        if (isDuplicateClientEvent(sessionId, request.clientEventId())) {
            return getSession(sessionId);
        }

        String eventType = request.eventType() == null
                ? "HEARTBEAT"
                : request.eventType().trim().toUpperCase(Locale.ROOT);
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        Map<String, Object> payload = new LinkedHashMap<>();
        if (request.clientEventId() != null && !request.clientEventId().isBlank()) {
            payload.put("clientEventId", request.clientEventId());
        }

        switch (eventType) {
            case "HEARTBEAT" -> jdbc.update("""
                    UPDATE worker_route_sessions
                       SET lease_expires_at = ?, updated_at = ?
                     WHERE id = ?
                    """, now.plus(ROUTE_LEASE), now, sessionId);
            case "ARRIVED", "ARRIVED_NODE" -> {
                String nodeId = requireNode(request.nodeId());
                releaseThroughNode(session, nodeId, now);
                jdbc.update("""
                        UPDATE worker_route_sessions
                           SET current_node_id = ?, status = 'ACTIVE',
                               lease_expires_at = ?, updated_at = ?
                         WHERE id = ?
                        """, nodeId, now.plus(ROUTE_LEASE), now, sessionId);
                if (Objects.equals(nodeId, session.endNodeId())
                        && pendingStopCount(sessionId) == 0) {
                    completeSession(session, now);
                    eventType = "ROUTE_COMPLETED";
                }
            }
            case "STOP_COMPLETED" -> {
                if (request.locationCode() == null || request.locationCode().isBlank()) {
                    throw new ResponseStatusException(
                            HttpStatus.BAD_REQUEST,
                            "locationCode is required for STOP_COMPLETED"
                    );
                }
                completeStopAndReplan(session, request.locationCode(), now);
                eventType = "STOP_COMPLETED";
            }
            case "COMPLETE" -> {
                if (pendingStopCount(sessionId) > 0) {
                    throw new ResponseStatusException(
                            HttpStatus.CONFLICT,
                            "Cannot complete a route with pending stops"
                    );
                }
                completeSession(session, now);
                eventType = "ROUTE_COMPLETED";
            }
            case "CANCEL" -> {
                releaseAllReservations(sessionId, now);
                jdbc.update("""
                        UPDATE worker_route_sessions
                           SET status = 'CANCELLED', cancelled_at = ?,
                               updated_at = ?, lease_expires_at = ?
                         WHERE id = ?
                        """, now, now, now, sessionId);
                eventType = "ROUTE_CANCELLED";
            }
            default -> throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Unsupported route event type: " + eventType
            );
        }

        SessionRow updated = sessionRow(sessionId, false);
        appendEvent(
                sessionId,
                updated.warehouseId(),
                updated.workerId(),
                eventType,
                request.nodeId(),
                request.locationCode(),
                updated.routeVersion(),
                payload
        );
        RouteSession response = getSession(sessionId);
        eventStream.publish(updated.warehouseId(), "route", response);
        return response;
    }

    public RoutingStats stats(UUID warehouseId) {
        UUID graphId = activeGraphId(warehouseId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "No active graph"
                ));
        return jdbc.queryForObject("""
                SELECT g.id, g.graph_hash, g.dataset_version,
                       g.node_count, g.edge_count, g.rack_footprint_count,
                       COUNT(DISTINCT s.id) FILTER (
                           WHERE s.status IN ('PLANNED', 'ACTIVE', 'WAITING')
                             AND s.lease_expires_at > NOW()
                       ) AS active_sessions,
                       COUNT(DISTINCT r.resource_key) FILTER (
                           WHERE r.status = 'RESERVED'
                       ) AS reserved_resources,
                       COUNT(DISTINCT s.id) FILTER (
                           WHERE s.status = 'WAITING'
                       ) AS waiting_sessions,
                       COUNT(DISTINCT s.id) FILTER (
                           WHERE s.status = 'EXPIRED'
                       ) AS expired_sessions
                  FROM warehouse_route_graphs g
                  LEFT JOIN worker_route_sessions s ON s.graph_id = g.id
                  LEFT JOIN worker_route_reservations r ON r.session_id = s.id
                 WHERE g.id = ?
                 GROUP BY g.id, g.graph_hash, g.dataset_version,
                          g.node_count, g.edge_count, g.rack_footprint_count
                """, (rs, rowNum) -> new RoutingStats(
                warehouseId,
                (UUID) rs.getObject("id"),
                rs.getString("graph_hash"),
                rs.getString("dataset_version"),
                rs.getInt("node_count"),
                rs.getInt("edge_count"),
                rs.getInt("rack_footprint_count"),
                rs.getInt("active_sessions"),
                rs.getInt("reserved_resources"),
                rs.getInt("waiting_sessions"),
                rs.getInt("expired_sessions")
        ), graphId);
    }

    @Scheduled(fixedDelay = 30_000L)
    @Transactional
    public void expireLeases() {
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        List<SessionRow> expired = jdbc.query("""
                SELECT *
                  FROM worker_route_sessions
                 WHERE status IN ('PLANNED', 'ACTIVE', 'WAITING')
                   AND lease_expires_at <= ?
                 FOR UPDATE SKIP LOCKED
                """, SESSION_ROW_MAPPER, now);
        for (SessionRow session : expired) {
            releaseAllReservations(session.id(), now);
            jdbc.update("""
                    UPDATE worker_route_sessions
                       SET status = 'EXPIRED', updated_at = ?
                     WHERE id = ?
                    """, now, session.id());
            appendEvent(
                    session.id(),
                    session.warehouseId(),
                    session.workerId(),
                    "ROUTE_EXPIRED",
                    session.currentNodeId(),
                    null,
                    session.routeVersion(),
                    Map.of("reason", "lease_expired")
            );
            eventStream.publish(
                    session.warehouseId(),
                    "route-expired",
                    Map.of("sessionId", session.id().toString())
            );
        }
    }

    private BuiltGraph buildGraph(String datasetVersion, List<DbLocation> locations) {
        List<DbLocation> storage = locations.stream()
                .filter(this::isStorage)
                .toList();
        if (storage.isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "The active dataset has no storage rack coordinates"
            );
        }

        Map<String, RackSeed> racks = new TreeMap<>();
        for (DbLocation location : storage) {
            String rackId = rackId(location);
            racks.computeIfAbsent(
                    rackId,
                    ignored -> new RackSeed(
                            rackId,
                            location.area(),
                            location.row(),
                            location.bay(),
                            location.x(),
                            location.y(),
                            new ArrayList<>()
                    )
            ).locationCodes().add(location.locationCode());
        }

        TreeSet<Double> rackXs = racks.values().stream()
                .map(RackSeed::x)
                .collect(Collectors.toCollection(TreeSet::new));
        TreeSet<Double> rackYs = racks.values().stream()
                .map(RackSeed::y)
                .collect(Collectors.toCollection(TreeSet::new));
        if (rackXs.isEmpty() || rackYs.isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Rack coordinates are incomplete"
            );
        }

        List<Double> rackXList = new ArrayList<>(rackXs);
        TreeSet<Double> aisleXs = new TreeSet<>();
        double outerSpacing = rackXList.size() > 1
                ? (rackXList.get(1) - rackXList.get(0)) / 2.0
                : 3.0;
        aisleXs.add(round3(rackXList.get(0) - outerSpacing));
        for (int index = 0; index < rackXList.size() - 1; index++) {
            aisleXs.add(round3((rackXList.get(index) + rackXList.get(index + 1)) / 2.0));
        }
        aisleXs.add(round3(rackXList.get(rackXList.size() - 1) + outerSpacing));

        TreeSet<Double> crossYs = new TreeSet<>();
        crossYs.add(round3(rackYs.first() - 3.0));
        crossYs.add(round3(rackYs.last() + 3.0));
        Map<String, DoubleRange> rowRanges = new TreeMap<>();
        for (RackSeed rack : racks.values()) {
            rowRanges.compute(
                    rack.row(),
                    (ignored, range) -> range == null
                            ? new DoubleRange(rack.y(), rack.y())
                            : new DoubleRange(
                                    Math.min(range.min(), rack.y()),
                                    Math.max(range.max(), rack.y())
                            )
            );
        }
        List<DoubleRange> orderedRanges = rowRanges.values().stream()
                .sorted(Comparator.comparingDouble(DoubleRange::min))
                .toList();
        for (int index = 0; index < orderedRanges.size() - 1; index++) {
            crossYs.add(round3(
                    (orderedRanges.get(index).max() + orderedRanges.get(index + 1).min()) / 2.0
            ));
        }

        TreeSet<Double> routeYs = new TreeSet<>(rackYs);
        routeYs.addAll(crossYs);
        Map<String, NodeDef> nodes = new LinkedHashMap<>();
        Map<String, EdgeDef> edges = new LinkedHashMap<>();
        List<AccessDef> access = new ArrayList<>();

        for (double aisleX : aisleXs) {
            for (double routeY : routeYs) {
                String id = aisleNodeId(aisleX, routeY);
                nodes.put(id, new NodeDef(
                        id,
                        crossYs.contains(routeY) ? "CROSS_AISLE" : "AISLE",
                        "Aisle " + fmt(aisleX) + " / " + fmt(routeY),
                        aisleX,
                        routeY,
                        Map.of("aisleX", aisleX, "crossAisle", crossYs.contains(routeY))
                ));
            }
            List<Double> ys = new ArrayList<>(routeYs);
            for (int index = 0; index < ys.size() - 1; index++) {
                addBidirectionalEdge(
                        edges,
                        aisleNodeId(aisleX, ys.get(index)),
                        aisleNodeId(aisleX, ys.get(index + 1)),
                        aisleX,
                        ys.get(index),
                        aisleX,
                        ys.get(index + 1),
                        "AISLE",
                        3.0
                );
            }
        }
        List<Double> aisleXList = new ArrayList<>(aisleXs);
        for (double crossY : crossYs) {
            for (int index = 0; index < aisleXList.size() - 1; index++) {
                addBidirectionalEdge(
                        edges,
                        aisleNodeId(aisleXList.get(index), crossY),
                        aisleNodeId(aisleXList.get(index + 1), crossY),
                        aisleXList.get(index),
                        crossY,
                        aisleXList.get(index + 1),
                        crossY,
                        "CROSS_AISLE",
                        3.5
                );
            }
        }

        List<RackFootprint> footprints = new ArrayList<>();
        for (RackSeed rack : racks.values()) {
            Double westAisle = aisleXs.lower(rack.x());
            Double eastAisle = aisleXs.higher(rack.x());
            List<String> faceIds = new ArrayList<>();
            if (westAisle != null) {
                String faceId = "FACE:" + rack.id() + ":WEST";
                double faceX = rack.x() - RACK_HALF_WIDTH_M;
                nodes.put(faceId, rackFaceNode(faceId, rack, "WEST", faceX));
                addBidirectionalEdge(
                        edges,
                        aisleNodeId(westAisle, rack.y()),
                        faceId,
                        westAisle,
                        rack.y(),
                        faceX,
                        rack.y(),
                        "RACK_APPROACH",
                        2.5
                );
                faceIds.add(faceId);
                for (String code : rack.locationCodes()) {
                    access.add(new AccessDef(code, faceId, "WEST", Math.abs(faceX - westAisle), true));
                }
            }
            if (eastAisle != null) {
                String faceId = "FACE:" + rack.id() + ":EAST";
                double faceX = rack.x() + RACK_HALF_WIDTH_M;
                nodes.put(faceId, rackFaceNode(faceId, rack, "EAST", faceX));
                addBidirectionalEdge(
                        edges,
                        faceId,
                        aisleNodeId(eastAisle, rack.y()),
                        faceX,
                        rack.y(),
                        eastAisle,
                        rack.y(),
                        "RACK_APPROACH",
                        2.5
                );
                faceIds.add(faceId);
                for (String code : rack.locationCodes()) {
                    access.add(new AccessDef(code, faceId, "EAST", Math.abs(eastAisle - faceX), false));
                }
            }
            footprints.add(new RackFootprint(
                    rack.id(),
                    rack.area(),
                    rack.row(),
                    rack.bay(),
                    rack.x(),
                    rack.y(),
                    RACK_HALF_WIDTH_M * 2.0,
                    RACK_DEPTH_M,
                    faceIds
            ));
        }

        for (DbLocation station : locations.stream().filter(location -> !isStorage(location)).toList()) {
            String stationNodeId = "STATION:" + station.locationCode();
            String nodeType = "DOOR".equalsIgnoreCase(station.zoneType())
                    ? "DOOR"
                    : "STATION";
            nodes.put(stationNodeId, new NodeDef(
                    stationNodeId,
                    nodeType,
                    station.locationCode(),
                    station.x(),
                    station.y(),
                    Map.of(
                            "locationCode", station.locationCode(),
                            "locationType", nullToEmpty(station.locationType()),
                            "zoneType", nullToEmpty(station.zoneType())
                    )
            ));
            connectOrthogonally(
                    nodes,
                    edges,
                    stationNodeId,
                    station.x(),
                    station.y(),
                    aisleXList.get(0),
                    crossYs.first(),
                    "STATION_LINK"
            );
            access.add(new AccessDef(
                    station.locationCode(),
                    stationNodeId,
                    "STATION",
                    0,
                    true
            ));
        }

        double minCrossY = crossYs.first();
        addParkingNode(
                nodes,
                edges,
                access,
                "PARK-IN",
                "Inbound Forklift Parking",
                aisleXList.get(0),
                minCrossY - 2.0,
                aisleXList.get(0),
                minCrossY
        );
        addParkingNode(
                nodes,
                edges,
                access,
                "PARK-OUT",
                "Outbound Forklift Parking",
                aisleXList.get(aisleXList.size() - 1),
                minCrossY - 2.0,
                aisleXList.get(aisleXList.size() - 1),
                minCrossY
        );

        String layoutVersion = datasetVersion.contains("V8")
                ? "CMB_METRIC_AISLE_V8_ROUTING"
                : datasetVersion + "_ROUTING";
        return new BuiltGraph(
                layoutVersion,
                new ArrayList<>(nodes.values()),
                new ArrayList<>(edges.values()),
                access,
                footprints
        );
    }

    private void persistGraph(UUID graphId, BuiltGraph built) {
        for (NodeDef node : built.nodes()) {
            jdbc.update("""
                    INSERT INTO warehouse_route_nodes(
                        graph_id, node_id, node_type, label,
                        coordinate_x, coordinate_y, walkable, metadata
                    ) VALUES (?, ?, ?, ?, ?, ?, TRUE, ?::jsonb)
                    """,
                    graphId,
                    node.id(),
                    node.type(),
                    node.label(),
                    node.x(),
                    node.y(),
                    json(node.metadata())
            );
        }
        for (EdgeDef edge : built.edges()) {
            jdbc.update("""
                    INSERT INTO warehouse_route_edges(
                        graph_id, edge_id, from_node_id, to_node_id,
                        resource_key, edge_type, distance_m,
                        base_travel_seconds, width_m, capacity,
                        one_way, turn_restricted, metadata
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, FALSE, FALSE, '{}'::jsonb)
                    """,
                    graphId,
                    edge.id(),
                    edge.from(),
                    edge.to(),
                    edge.resourceKey(),
                    edge.type(),
                    edge.distanceM(),
                    edge.distanceM() / DEFAULT_SPEED_MPS,
                    edge.widthM()
            );
        }
        for (AccessDef mapping : built.access()) {
            jdbc.update("""
                    INSERT INTO warehouse_location_route_access(
                        graph_id, location_code, access_node_id,
                        access_side, approach_distance_m, preferred
                    ) VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    graphId,
                    mapping.locationCode(),
                    mapping.accessNodeId(),
                    mapping.side(),
                    mapping.approachDistanceM(),
                    mapping.preferred()
            );
        }
    }

    private WarehouseGraph loadGraph(UUID graphId) {
        GraphHeader header = jdbc.queryForObject("""
                SELECT id, warehouse_id, dataset_version, layout_version,
                       graph_hash, rack_footprint_count
                  FROM warehouse_route_graphs
                 WHERE id = ?
                """, (rs, rowNum) -> new GraphHeader(
                (UUID) rs.getObject("id"),
                (UUID) rs.getObject("warehouse_id"),
                rs.getString("dataset_version"),
                rs.getString("layout_version"),
                rs.getString("graph_hash"),
                rs.getInt("rack_footprint_count")
        ), graphId);

        List<GraphNode> nodes = jdbc.query("""
                SELECT node_id, node_type, label, coordinate_x, coordinate_y, metadata
                  FROM warehouse_route_nodes
                 WHERE graph_id = ?
                 ORDER BY node_id
                """, (rs, rowNum) -> new GraphNode(
                rs.getString("node_id"),
                rs.getString("node_type"),
                rs.getString("label"),
                rs.getBigDecimal("coordinate_x").doubleValue(),
                rs.getBigDecimal("coordinate_y").doubleValue(),
                parseJson(rs.getString("metadata"))
        ), graphId);
        List<GraphEdge> edges = jdbc.query("""
                SELECT edge_id, from_node_id, to_node_id, resource_key,
                       edge_type, distance_m, base_travel_seconds,
                       COALESCE(width_m, 0) AS width_m, capacity
                  FROM warehouse_route_edges
                 WHERE graph_id = ?
                 ORDER BY edge_id
                """, (rs, rowNum) -> new GraphEdge(
                rs.getString("edge_id"),
                rs.getString("from_node_id"),
                rs.getString("to_node_id"),
                rs.getString("resource_key"),
                rs.getString("edge_type"),
                rs.getBigDecimal("distance_m").doubleValue(),
                rs.getBigDecimal("base_travel_seconds").doubleValue(),
                rs.getBigDecimal("width_m").doubleValue(),
                rs.getInt("capacity")
        ), graphId);

        Map<String, List<GraphNode>> facesByRack = nodes.stream()
                .filter(node -> "RACK_FACE".equals(node.type()))
                .filter(node -> node.metadata().get("rackId") != null)
                .collect(Collectors.groupingBy(
                        node -> String.valueOf(node.metadata().get("rackId")),
                        TreeMap::new,
                        Collectors.toList()
                ));
        List<RackFootprint> racks = facesByRack.entrySet().stream()
                .map(entry -> {
                    GraphNode sample = entry.getValue().get(0);
                    Map<String, Object> metadata = sample.metadata();
                    return new RackFootprint(
                            entry.getKey(),
                            String.valueOf(metadata.get("area")),
                            String.valueOf(metadata.get("row")),
                            String.valueOf(metadata.get("bay")),
                            asDouble(metadata.get("rackX")),
                            asDouble(metadata.get("rackY")),
                            RACK_HALF_WIDTH_M * 2.0,
                            RACK_DEPTH_M,
                            entry.getValue().stream().map(GraphNode::id).sorted().toList()
                    );
                })
                .toList();
        return new WarehouseGraph(
                header.id(),
                header.warehouseId(),
                header.datasetVersion(),
                header.layoutVersion(),
                header.graphHash(),
                header.rackFootprintCount(),
                nodes,
                edges,
                racks
        );
    }

    private GraphData graphData(UUID graphId) {
        WarehouseGraph graph = loadGraph(graphId);
        Map<String, GraphNode> nodes = graph.nodes().stream()
                .collect(Collectors.toMap(GraphNode::id, node -> node));
        Map<String, List<GraphEdge>> adjacency = new HashMap<>();
        for (GraphEdge edge : graph.edges()) {
            adjacency.computeIfAbsent(edge.from(), ignored -> new ArrayList<>()).add(edge);
        }
        Map<String, List<String>> accessByLocation = new HashMap<>();
        jdbc.query("""
                SELECT location_code, access_node_id
                  FROM warehouse_location_route_access
                 WHERE graph_id = ?
                 ORDER BY location_code, preferred DESC, access_node_id
                """, rs -> {
            accessByLocation.computeIfAbsent(
                    rs.getString("location_code"),
                    ignored -> new ArrayList<>()
            ).add(rs.getString("access_node_id"));
        }, graphId);
        return new GraphData(graph, nodes, adjacency, accessByLocation);
    }

    private List<OrderedStop> orderStops(
            GraphData graph,
            String startNode,
            Collection<String> requestedCodes
    ) {
        LinkedHashSet<String> uniqueCodes = requestedCodes.stream()
                .filter(Objects::nonNull)
                .map(code -> code.trim().toUpperCase(Locale.ROOT))
                .filter(code -> !code.isBlank())
                .collect(Collectors.toCollection(LinkedHashSet::new));
        List<String> missing = uniqueCodes.stream()
                .filter(code -> !graph.accessByLocation().containsKey(code))
                .toList();
        if (!missing.isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Locations are not mapped to the active graph: " + String.join(", ", missing)
            );
        }

        List<OrderedStop> ordered = new ArrayList<>();
        Set<String> remaining = new LinkedHashSet<>(uniqueCodes);
        String cursor = startNode;
        while (!remaining.isEmpty()) {
            StopChoice best = null;
            for (String code : remaining) {
                for (String accessNode : graph.accessByLocation().get(code)) {
                    double distance = staticDistance(graph, cursor, accessNode);
                    StopChoice candidate = new StopChoice(code, accessNode, distance);
                    if (best == null
                            || candidate.distanceM() < best.distanceM()
                            || (candidate.distanceM() == best.distanceM()
                            && candidate.locationCode().compareTo(best.locationCode()) < 0)) {
                        best = candidate;
                    }
                }
            }
            if (best == null || !Double.isFinite(best.distanceM())) {
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "No traversable route exists to the remaining locations"
                );
            }
            ordered.add(new OrderedStop(best.locationCode(), best.accessNodeId()));
            remaining.remove(best.locationCode());
            cursor = best.accessNodeId();
        }
        return ordered;
    }

    private PlannedRoute planWaypoints(
            GraphData graph,
            String startNode,
            List<String> waypoints,
            OffsetDateTime startAt,
            UUID excludedSession,
            String vehicleType
    ) {
        List<ReservationWindow> windows = loadReservationWindows(
                graph.graph().warehouseId(),
                excludedSession
        );
        List<PathStep> allSteps = new ArrayList<>();
        String cursor = startNode;
        OffsetDateTime cursorTime = startAt;
        double totalDistance = 0;
        double totalWait = 0;
        for (String waypoint : waypoints) {
            if (cursor.equals(waypoint)) {
                continue;
            }
            PathResult result = timeAwarePath(
                    graph,
                    cursor,
                    waypoint,
                    cursorTime,
                    windows,
                    vehicleType
            );
            if (result.steps().isEmpty()) {
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "No conflict-free route from " + cursor + " to " + waypoint
                );
            }
            allSteps.addAll(result.steps());
            cursor = waypoint;
            cursorTime = result.arrival();
            totalDistance += result.distanceM();
            totalWait += result.waitSeconds();
        }
        return new PlannedRoute(
                allSteps,
                totalDistance,
                Duration.between(startAt, cursorTime).toMillis() / 1000.0,
                totalWait
        );
    }

    private PathResult timeAwarePath(
            GraphData graph,
            String start,
            String goal,
            OffsetDateTime startAt,
            List<ReservationWindow> windows,
            String vehicleType
    ) {
        if (!graph.nodes().containsKey(start) || !graph.nodes().containsKey(goal)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Route start or goal is absent from the active graph"
            );
        }
        double speed = speedFor(vehicleType);
        Map<String, List<ReservationWindow>> byResource = windows.stream()
                .collect(Collectors.groupingBy(ReservationWindow::resourceKey));
        Map<String, OffsetDateTime> bestArrival = new HashMap<>();
        Map<String, SearchParent> parent = new HashMap<>();
        PriorityQueue<SearchState> open = new PriorityQueue<>(
                Comparator.comparing(SearchState::estimatedEpochSeconds)
        );
        bestArrival.put(start, startAt);
        open.add(new SearchState(
                start,
                startAt,
                epoch(startAt) + heuristicSeconds(graph, start, goal, speed)
        ));
        int expanded = 0;

        while (!open.isEmpty() && expanded < 100_000) {
            SearchState current = open.poll();
            OffsetDateTime known = bestArrival.get(current.nodeId());
            if (known == null || current.arrival().isAfter(known)) {
                continue;
            }
            if (current.nodeId().equals(goal)) {
                return reconstructPath(parent, start, goal, startAt);
            }
            expanded++;
            for (GraphEdge edge : graph.adjacency().getOrDefault(current.nodeId(), List.of())) {
                double travelSeconds = edge.distanceM() / speed;
                OffsetDateTime depart = earliestDeparture(
                        current.arrival(),
                        travelSeconds,
                        byResource.getOrDefault("EDGE:" + edge.resourceKey(), List.of()),
                        byResource.getOrDefault("NODE:" + edge.to(), List.of())
                );
                OffsetDateTime arrival = depart.plusNanos((long) (travelSeconds * 1_000_000_000L));
                if (arrival.isBefore(bestArrival.getOrDefault(
                        edge.to(),
                        OffsetDateTime.MAX
                ))) {
                    bestArrival.put(edge.to(), arrival);
                    parent.put(edge.to(), new SearchParent(
                            current.nodeId(),
                            edge,
                            depart,
                            arrival
                    ));
                    open.add(new SearchState(
                            edge.to(),
                            arrival,
                            epoch(arrival) + heuristicSeconds(graph, edge.to(), goal, speed)
                    ));
                }
            }
        }
        return new PathResult(List.of(), startAt, 0, 0);
    }

    private OffsetDateTime earliestDeparture(
            OffsetDateTime requested,
            double travelSeconds,
            List<ReservationWindow> edgeWindows,
            List<ReservationWindow> nodeWindows
    ) {
        OffsetDateTime candidate = requested;
        Duration travel = Duration.ofNanos((long) (travelSeconds * 1_000_000_000L));
        Duration headway = Duration.ofNanos((long) (SAFETY_HEADWAY_SECONDS * 1_000_000_000L));
        for (int iteration = 0; iteration < 10_000; iteration++) {
            OffsetDateTime arrival = candidate.plus(travel);
            OffsetDateTime blockedUntil = null;
            for (ReservationWindow window : edgeWindows) {
                if (overlaps(
                        candidate.minus(headway),
                        arrival.plus(headway),
                        window.from(),
                        window.until()
                )) {
                    blockedUntil = max(blockedUntil, window.until().plus(headway));
                }
            }
            for (ReservationWindow window : nodeWindows) {
                if (overlaps(
                        arrival.minus(headway),
                        arrival.plus(headway),
                        window.from(),
                        window.until()
                )) {
                    blockedUntil = max(blockedUntil, window.until().plus(headway));
                }
            }
            if (blockedUntil == null) {
                return candidate;
            }
            candidate = blockedUntil;
        }
        throw new ResponseStatusException(
                HttpStatus.CONFLICT,
                "No safe reservation interval is available"
        );
    }

    private PathResult reconstructPath(
            Map<String, SearchParent> parents,
            String start,
            String goal,
            OffsetDateTime startAt
    ) {
        List<PathStep> reverse = new ArrayList<>();
        String cursor = goal;
        double distance = 0;
        while (!cursor.equals(start)) {
            SearchParent parent = parents.get(cursor);
            if (parent == null) {
                return new PathResult(List.of(), startAt, 0, 0);
            }
            reverse.add(new PathStep(
                    parent.edge(),
                    parent.departed(),
                    parent.arrived()
            ));
            distance += parent.edge().distanceM();
            cursor = parent.previousNode();
        }
        java.util.Collections.reverse(reverse);
        double wait = 0;
        OffsetDateTime cursorTime = startAt;
        for (PathStep step : reverse) {
            wait += Math.max(
                    0,
                    Duration.between(cursorTime, step.departed()).toMillis() / 1000.0
            );
            cursorTime = step.arrived();
        }
        OffsetDateTime arrival = reverse.isEmpty()
                ? startAt
                : reverse.get(reverse.size() - 1).arrived();
        return new PathResult(reverse, arrival, distance, wait);
    }

    private double staticDistance(GraphData graph, String start, String goal) {
        if (start.equals(goal)) return 0;
        Map<String, Double> distance = new HashMap<>();
        PriorityQueue<DistanceState> queue = new PriorityQueue<>(
                Comparator.comparingDouble(DistanceState::distance)
        );
        distance.put(start, 0.0);
        queue.add(new DistanceState(start, 0));
        while (!queue.isEmpty()) {
            DistanceState current = queue.poll();
            if (current.distance() > distance.getOrDefault(current.nodeId(), Double.POSITIVE_INFINITY)) {
                continue;
            }
            if (current.nodeId().equals(goal)) {
                return current.distance();
            }
            for (GraphEdge edge : graph.adjacency().getOrDefault(current.nodeId(), List.of())) {
                double candidate = current.distance() + edge.distanceM();
                if (candidate < distance.getOrDefault(edge.to(), Double.POSITIVE_INFINITY)) {
                    distance.put(edge.to(), candidate);
                    queue.add(new DistanceState(edge.to(), candidate));
                }
            }
        }
        return Double.POSITIVE_INFINITY;
    }

    private void completeStopAndReplan(
            SessionRow session,
            String rawLocationCode,
            OffsetDateTime now
    ) {
        String locationCode = rawLocationCode.trim().toUpperCase(Locale.ROOT);
        Map<String, Object> stop = jdbc.query("""
                SELECT id, access_node_id, status
                  FROM worker_route_stops
                 WHERE session_id = ? AND UPPER(location_code) = ?
                 FOR UPDATE
                """, rs -> {
            if (!rs.next()) return null;
            Map<String, Object> row = new HashMap<>();
            row.put("id", rs.getObject("id"));
            row.put("access", rs.getString("access_node_id"));
            row.put("status", rs.getString("status"));
            return row;
        }, session.id(), locationCode);
        if (stop == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "The scanned location is not a stop in this route"
            );
        }
        if ("COMPLETED".equals(stop.get("status"))) {
            return;
        }

        String accessNode = String.valueOf(stop.get("access"));
        releaseAllReservations(session.id(), now);
        jdbc.update("""
                UPDATE worker_route_stops
                   SET status = 'COMPLETED', completed_at = ?
                 WHERE id = ?
                """, now, stop.get("id"));
        jdbc.update("""
                WITH next_stop AS (
                    SELECT id
                      FROM worker_route_stops
                     WHERE session_id = ? AND status = 'PENDING'
                     ORDER BY sequence_no
                     LIMIT 1
                )
                UPDATE worker_route_stops
                   SET status = 'CURRENT'
                 WHERE id IN (SELECT id FROM next_stop)
                """, session.id());

        List<OrderedStop> remaining = jdbc.query("""
                SELECT location_code, access_node_id
                  FROM worker_route_stops
                 WHERE session_id = ? AND status IN ('CURRENT', 'PENDING')
                 ORDER BY sequence_no
                """, (rs, rowNum) -> new OrderedStop(
                rs.getString("location_code"),
                rs.getString("access_node_id")
        ), session.id());
        List<String> waypointNodes = remaining.stream()
                .map(OrderedStop::accessNodeId)
                .collect(Collectors.toCollection(ArrayList::new));
        if (session.endNodeId() != null
                && !session.endNodeId().equals(waypointNodes.isEmpty()
                ? accessNode
                : waypointNodes.get(waypointNodes.size() - 1))) {
            waypointNodes.add(session.endNodeId());
        }

        int newVersion = session.routeVersion() + 1;
        PlannedRoute replanned = planWaypoints(
                graphData(session.graphId()),
                accessNode,
                waypointNodes,
                now,
                session.id(),
                session.vehicleType()
        );
        persistPlan(session.id(), newVersion, replanned);
        jdbc.update("""
                UPDATE worker_route_sessions
                   SET current_node_id = ?, route_version = ?, status = 'ACTIVE',
                       total_distance_m = ?, estimated_travel_seconds = ?,
                       total_wait_seconds = ?, lease_expires_at = ?, updated_at = ?
                 WHERE id = ?
                """,
                accessNode,
                newVersion,
                replanned.totalDistanceM(),
                replanned.estimatedTravelSeconds(),
                replanned.totalWaitSeconds(),
                now.plus(ROUTE_LEASE),
                now,
                session.id()
        );
    }

    private void persistPlan(UUID sessionId, int routeVersion, PlannedRoute route) {
        int sequence = 0;
        for (PathStep step : route.steps()) {
            sequence++;
            jdbc.update("""
                    INSERT INTO worker_route_reservations(
                        id, session_id, route_version, sequence_no,
                        resource_type, resource_key, from_node_id, to_node_id,
                        reserved_from, reserved_until, status
                    ) VALUES (?, ?, ?, ?, 'EDGE', ?, ?, ?, ?, ?, 'RESERVED')
                    """,
                    UUID.randomUUID(),
                    sessionId,
                    routeVersion,
                    sequence,
                    "EDGE:" + step.edge().resourceKey(),
                    step.edge().from(),
                    step.edge().to(),
                    step.departed(),
                    step.arrived()
            );
            jdbc.update("""
                    INSERT INTO worker_route_reservations(
                        id, session_id, route_version, sequence_no,
                        resource_type, resource_key, from_node_id, to_node_id,
                        reserved_from, reserved_until, status
                    ) VALUES (?, ?, ?, ?, 'NODE', ?, ?, ?, ?, ?, 'RESERVED')
                    """,
                    UUID.randomUUID(),
                    sessionId,
                    routeVersion,
                    sequence,
                    "NODE:" + step.edge().to(),
                    step.edge().from(),
                    step.edge().to(),
                    step.arrived().minusSeconds((long) SAFETY_HEADWAY_SECONDS),
                    step.arrived().plusSeconds((long) SAFETY_HEADWAY_SECONDS)
            );
        }
    }

    private void updateSessionMetrics(UUID sessionId, PlannedRoute route, OffsetDateTime now) {
        jdbc.update("""
                UPDATE worker_route_sessions
                   SET total_distance_m = ?, estimated_travel_seconds = ?,
                       total_wait_seconds = ?, lease_expires_at = ?, updated_at = ?
                 WHERE id = ?
                """,
                route.totalDistanceM(),
                route.estimatedTravelSeconds(),
                route.totalWaitSeconds(),
                now.plus(ROUTE_LEASE),
                now,
                sessionId
        );
    }

    private List<ReservationWindow> loadReservationWindows(
            UUID warehouseId,
            UUID excludedSession
    ) {
        return jdbc.query("""
                SELECT r.session_id, r.resource_key, r.reserved_from, r.reserved_until
                  FROM worker_route_reservations r
                  JOIN worker_route_sessions s ON s.id = r.session_id
                 WHERE s.warehouse_id = ?
                   AND s.status IN ('PLANNED', 'ACTIVE', 'WAITING')
                   AND s.lease_expires_at > NOW()
                   AND r.status = 'RESERVED'
                   AND (?::uuid IS NULL OR r.session_id <> ?::uuid)
                 ORDER BY r.resource_key, r.reserved_from
                """, (rs, rowNum) -> new ReservationWindow(
                (UUID) rs.getObject("session_id"),
                rs.getString("resource_key"),
                rs.getObject("reserved_from", OffsetDateTime.class),
                rs.getObject("reserved_until", OffsetDateTime.class)
        ), warehouseId, excludedSession, excludedSession);
    }

    private void releaseThroughNode(SessionRow session, String nodeId, OffsetDateTime now) {
        Integer sequence = jdbc.query("""
                SELECT MIN(sequence_no)
                  FROM worker_route_reservations
                 WHERE session_id = ?
                   AND route_version = ?
                   AND resource_type = 'EDGE'
                   AND to_node_id = ?
                   AND status = 'RESERVED'
                """, rs -> rs.next() ? (Integer) rs.getObject(1) : null,
                session.id(),
                session.routeVersion(),
                nodeId
        );
        if (sequence != null) {
            jdbc.update("""
                    UPDATE worker_route_reservations
                       SET status = 'RELEASED', released_at = ?
                     WHERE session_id = ?
                       AND route_version = ?
                       AND sequence_no <= ?
                       AND status = 'RESERVED'
                    """, now, session.id(), session.routeVersion(), sequence);
        }
    }

    private void releaseAllReservations(UUID sessionId, OffsetDateTime now) {
        jdbc.update("""
                UPDATE worker_route_reservations
                   SET status = 'RELEASED', released_at = ?
                 WHERE session_id = ? AND status = 'RESERVED'
                """, now, sessionId);
    }

    private void completeSession(SessionRow session, OffsetDateTime now) {
        releaseAllReservations(session.id(), now);
        jdbc.update("""
                UPDATE worker_route_sessions
                   SET status = 'COMPLETED', completed_at = ?,
                       updated_at = ?, lease_expires_at = ?
                 WHERE id = ?
                """, now, now, now, session.id());
    }

    private int pendingStopCount(UUID sessionId) {
        Integer count = jdbc.queryForObject("""
                SELECT COUNT(*)
                  FROM worker_route_stops
                 WHERE session_id = ? AND status IN ('CURRENT', 'PENDING')
                """, Integer.class, sessionId);
        return count == null ? 0 : count;
    }

    private boolean isDuplicateClientEvent(UUID sessionId, String clientEventId) {
        if (clientEventId == null || clientEventId.isBlank()) return false;
        Boolean duplicate = jdbc.queryForObject("""
                SELECT EXISTS(
                    SELECT 1
                      FROM worker_route_events
                     WHERE session_id = ?
                       AND payload ->> 'clientEventId' = ?
                )
                """, Boolean.class, sessionId, clientEventId);
        return Boolean.TRUE.equals(duplicate);
    }

    private void ensureWorkerAndTaskScope(UUID workerId, UUID taskId, UUID warehouseId) {
        Boolean workerExists = jdbc.queryForObject(
                """
                SELECT EXISTS(
                    SELECT 1
                      FROM users
                     WHERE id = ?
                       AND LOWER(COALESCE(status, '')) = 'active'
                )
                """,
                Boolean.class,
                workerId
        );
        if (!Boolean.TRUE.equals(workerExists)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Active worker not found");
        }
        if (taskId == null) return;
        Map<String, Object> task = jdbc.query(
                "SELECT warehouse_id, assigned_to, status FROM tasks WHERE id = ?",
                rs -> {
                    if (!rs.next()) return null;
                    Map<String, Object> row = new HashMap<>();
                    row.put("warehouseId", rs.getObject("warehouse_id"));
                    row.put("assignedTo", rs.getObject("assigned_to"));
                    row.put("status", rs.getString("status"));
                    return row;
                },
                taskId
        );
        if (task == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Task not found");
        }
        if (!warehouseId.equals(task.get("warehouseId"))) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Task does not belong to the requested warehouse"
            );
        }
        Object assigned = task.get("assignedTo");
        if (assigned != null && !workerId.equals(assigned)) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Task is assigned to another worker"
            );
        }
    }

    private String resolveStartNode(GraphData graph, String operation, String requested) {
        if (requested != null && !requested.isBlank()) {
            return requireGraphNode(graph, requested);
        }
        return switch (operation) {
            case "PUTAWAY" -> firstExistingNode(
                    graph,
                    "STATION:STG-01",
                    "PARKING:PARK-IN",
                    "STATION:RCV-01"
            );
            case "PICKING" -> firstExistingNode(
                    graph,
                    "PARKING:PARK-OUT",
                    "STATION:DSP-01",
                    "STATION:PACK-01"
            );
            default -> firstExistingNode(
                    graph,
                    "PARKING:PARK-IN",
                    "STATION:STG-01"
            );
        };
    }

    private String resolveEndNode(GraphData graph, String operation, String requested) {
        if (requested != null && !requested.isBlank()) {
            return requireGraphNode(graph, requested);
        }
        return switch (operation) {
            case "PICKING" -> firstExistingNode(
                    graph,
                    "STATION:PACK-01",
                    "STATION:DSP-01"
            );
            case "PUTAWAY" -> firstExistingNode(
                    graph,
                    "PARKING:PARK-IN",
                    "STATION:STG-01"
            );
            default -> null;
        };
    }

    private String firstExistingNode(GraphData graph, String... candidates) {
        for (String candidate : candidates) {
            if (graph.nodes().containsKey(candidate)) return candidate;
        }
        return graph.nodes().keySet().stream().sorted().findFirst()
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "Active graph has no nodes"
                ));
    }

    private String requireGraphNode(GraphData graph, String nodeId) {
        if (!graph.nodes().containsKey(nodeId)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Node is not part of the active graph: " + nodeId
            );
        }
        return nodeId;
    }

    private String requireNode(String nodeId) {
        if (nodeId == null || nodeId.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "nodeId is required"
            );
        }
        return nodeId;
    }

    private SessionRow sessionRow(UUID sessionId, boolean forUpdate) {
        String sql = "SELECT * FROM worker_route_sessions WHERE id = ?"
                + (forUpdate ? " FOR UPDATE" : "");
        List<SessionRow> rows = jdbc.query(sql, SESSION_ROW_MAPPER, sessionId);
        if (rows.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Route session not found");
        }
        return rows.get(0);
    }

    private Optional<UUID> activeGraphId(UUID warehouseId) {
        return jdbc.query("""
                SELECT id
                  FROM warehouse_route_graphs
                 WHERE warehouse_id = ? AND status = 'ACTIVE'
                 ORDER BY generated_at DESC
                 LIMIT 1
                """, rs -> rs.next()
                ? Optional.of((UUID) rs.getObject(1))
                : Optional.empty(), warehouseId);
    }

    private void appendEvent(
            UUID sessionId,
            UUID warehouseId,
            UUID workerId,
            String eventType,
            String nodeId,
            String locationCode,
            Integer routeVersion,
            Map<String, Object> payload
    ) {
        jdbc.update("""
                INSERT INTO worker_route_events(
                    session_id, warehouse_id, worker_id, event_type,
                    node_id, location_code, route_version, payload
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?::jsonb)
                """,
                sessionId,
                warehouseId,
                workerId,
                eventType,
                nodeId,
                locationCode,
                routeVersion,
                json(payload)
        );
    }

    private void lockWarehouseRouting(UUID warehouseId) {
        jdbc.query(
                "SELECT pg_advisory_xact_lock(hashtext(?))",
                rs -> null,
                "worker-routing:" + warehouseId
        );
    }

    private String hashGraph(BuiltGraph graph) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            graph.nodes().stream()
                    .sorted(Comparator.comparing(NodeDef::id))
                    .forEach(node -> digest.update((
                            node.id() + "|" + node.type() + "|" + fmt(node.x()) + "|" + fmt(node.y()) + "\n"
                    ).getBytes(StandardCharsets.UTF_8)));
            graph.edges().stream()
                    .sorted(Comparator.comparing(EdgeDef::id))
                    .forEach(edge -> digest.update((
                            edge.id() + "|" + edge.from() + "|" + edge.to() + "|"
                                    + fmt(edge.distanceM()) + "\n"
                    ).getBytes(StandardCharsets.UTF_8)));
            graph.access().stream()
                    .sorted(Comparator.comparing(AccessDef::locationCode)
                            .thenComparing(AccessDef::accessNodeId))
                    .forEach(mapping -> digest.update((
                            mapping.locationCode() + "|" + mapping.accessNodeId()
                                    + "|" + mapping.side() + "\n"
                    ).getBytes(StandardCharsets.UTF_8)));
            return java.util.HexFormat.of().formatHex(digest.digest());
        } catch (Exception error) {
            throw new IllegalStateException("Unable to hash warehouse graph", error);
        }
    }

    private NodeDef rackFaceNode(
            String faceId,
            RackSeed rack,
            String side,
            double faceX
    ) {
        return new NodeDef(
                faceId,
                "RACK_FACE",
                rack.id() + " " + side,
                faceX,
                rack.y(),
                Map.of(
                        "rackId", rack.id(),
                        "area", rack.area(),
                        "row", rack.row(),
                        "bay", rack.bay(),
                        "rackX", rack.x(),
                        "rackY", rack.y(),
                        "accessSide", side
                )
        );
    }

    private void addParkingNode(
            Map<String, NodeDef> nodes,
            Map<String, EdgeDef> edges,
            List<AccessDef> access,
            String code,
            String label,
            double x,
            double y,
            double connectX,
            double connectY
    ) {
        String id = "PARKING:" + code;
        nodes.put(id, new NodeDef(
                id,
                "PARKING",
                label,
                x,
                y,
                Map.of("locationCode", code)
        ));
        addBidirectionalEdge(
                edges,
                id,
                aisleNodeId(connectX, connectY),
                x,
                y,
                connectX,
                connectY,
                "PARKING_LINK",
                3.5
        );
        access.add(new AccessDef(code, id, "STATION", 0, true));
    }

    private void connectOrthogonally(
            Map<String, NodeDef> nodes,
            Map<String, EdgeDef> edges,
            String startId,
            double startX,
            double startY,
            double aisleX,
            double crossY,
            String edgeType
    ) {
        String aisleId = aisleNodeId(aisleX, crossY);
        boolean needsVertical = Math.abs(startY - crossY) > 0.0001;
        boolean needsHorizontal = Math.abs(startX - aisleX) > 0.0001;
        if (needsVertical && needsHorizontal) {
            String bendId = "WAIT:" + fmt(startX) + ":" + fmt(crossY);
            if (!nodes.containsKey(bendId)) {
                nodes.put(bendId, new NodeDef(
                        bendId,
                        "WAIT",
                        "Station approach",
                        startX,
                        crossY,
                        Map.of("stationApproach", true)
                ));
            }
            addBidirectionalEdge(
                    edges,
                    startId,
                    bendId,
                    startX,
                    startY,
                    startX,
                    crossY,
                    edgeType,
                    3.5
            );
            addBidirectionalEdge(
                    edges,
                    bendId,
                    aisleId,
                    startX,
                    crossY,
                    aisleX,
                    crossY,
                    edgeType,
                    3.5
            );
        } else if (needsVertical || needsHorizontal) {
            // When the station is aligned with the aisle, linking directly is
            // essential: a zero-length WAIT node would otherwise be a distinct,
            // disconnected graph vertex.
            addBidirectionalEdge(
                    edges,
                    startId,
                    aisleId,
                    startX,
                    startY,
                    aisleX,
                    crossY,
                    edgeType,
                    3.5
            );
        }
    }

    private void addBidirectionalEdge(
            Map<String, EdgeDef> edges,
            String from,
            String to,
            double fromX,
            double fromY,
            double toX,
            double toY,
            String type,
            double widthM
    ) {
        double distance = Math.abs(fromX - toX) + Math.abs(fromY - toY);
        if (distance <= 0.0001 || from.equals(to)) return;
        String forwardId = edgeId(from, to);
        String reverseId = edgeId(to, from);
        String resource = canonicalResource(from, to);
        edges.put(forwardId, new EdgeDef(
                forwardId, from, to, resource, type, distance, widthM
        ));
        edges.put(reverseId, new EdgeDef(
                reverseId, to, from, resource, type, distance, widthM
        ));
    }

    private String edgeId(String from, String to) {
        return from + ">" + to;
    }

    private String canonicalResource(String from, String to) {
        return from.compareTo(to) <= 0
                ? from + "<>" + to
                : to + "<>" + from;
    }

    private String aisleNodeId(double x, double y) {
        return "AISLE:" + fmt(x) + ":" + fmt(y);
    }

    private String rackId(DbLocation location) {
        return location.area() + "-" + location.row() + "-" + location.bay();
    }

    private boolean isStorage(DbLocation location) {
        String type = nullToEmpty(location.locationType()).toUpperCase(Locale.ROOT);
        String zone = nullToEmpty(location.zoneType()).toUpperCase(Locale.ROOT);
        return Set.of("STORAGE", "PICKING", "BULK").contains(type)
                || Set.of("STORAGE", "PICK_FACE", "RESERVE").contains(zone);
    }

    private String normalizeOperation(String raw) {
        String operation = raw == null
                ? "PUTAWAY"
                : raw.trim().toUpperCase(Locale.ROOT);
        if (!Set.of("PUTAWAY", "PICKING", "TRANSFER", "REPLENISHMENT").contains(operation)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Unsupported operationType: " + operation
            );
        }
        return operation;
    }

    private String normalizeVehicle(String raw) {
        String vehicle = raw == null || raw.isBlank()
                ? "FORKLIFT"
                : raw.trim().toUpperCase(Locale.ROOT);
        if (!Set.of("WORKER", "PALLET_JACK", "REACH_TRUCK", "FORKLIFT").contains(vehicle)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Unsupported vehicleType: " + vehicle
            );
        }
        return vehicle;
    }

    private double speedFor(String vehicleType) {
        return switch (vehicleType) {
            case "WORKER" -> 1.2;
            case "PALLET_JACK" -> 1.4;
            case "REACH_TRUCK" -> 1.7;
            default -> 1.5;
        };
    }

    private double heuristicSeconds(
            GraphData graph,
            String from,
            String to,
            double speed
    ) {
        GraphNode a = graph.nodes().get(from);
        GraphNode b = graph.nodes().get(to);
        return (Math.abs(a.x() - b.x()) + Math.abs(a.y() - b.y())) / speed;
    }

    private boolean overlaps(
            OffsetDateTime aStart,
            OffsetDateTime aEnd,
            OffsetDateTime bStart,
            OffsetDateTime bEnd
    ) {
        return aStart.isBefore(bEnd) && bStart.isBefore(aEnd);
    }

    private OffsetDateTime max(OffsetDateTime a, OffsetDateTime b) {
        if (a == null) return b;
        return a.isAfter(b) ? a : b;
    }

    private double epoch(OffsetDateTime value) {
        return value.toInstant().toEpochMilli() / 1000.0;
    }

    private UUID parseUuid(String raw, String field) {
        UUID parsed = nullableUuid(raw, field);
        if (parsed == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    field + " is required"
            );
        }
        return parsed;
    }

    private UUID nullableUuid(String raw, String field) {
        if (raw == null || raw.isBlank()) return null;
        try {
            return UUID.fromString(raw);
        } catch (IllegalArgumentException error) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    field + " must be a UUID"
            );
        }
    }

    private String json(Object value) {
        try {
            return objectMapper.writeValueAsString(value == null ? Map.of() : value);
        } catch (Exception error) {
            throw new IllegalStateException("Unable to serialize routing metadata", error);
        }
    }

    private Map<String, Object> parseJson(String value) {
        if (value == null || value.isBlank()) return Map.of();
        try {
            return objectMapper.readValue(value, new TypeReference<>() {});
        } catch (Exception error) {
            return Map.of();
        }
    }

    private double asDouble(Object value) {
        if (value instanceof Number number) return number.doubleValue();
        return Double.parseDouble(String.valueOf(value));
    }

    private double round3(double value) {
        return Math.round(value * 1000.0) / 1000.0;
    }

    private String fmt(double value) {
        return String.format(Locale.ROOT, "%.3f", round3(value));
    }

    private String nullToEmpty(String value) {
        return value == null ? "" : value;
    }

    private static final RowMapper<DbLocation> DB_LOCATION_MAPPER =
            (rs, rowNum) -> new DbLocation(
                    rs.getString("location_code"),
                    rs.getString("area"),
                    rs.getString("row_number"),
                    rs.getString("bay_number"),
                    rs.getString("location_type"),
                    rs.getString("zone_type"),
                    rs.getBigDecimal("coordinate_x").doubleValue(),
                    rs.getBigDecimal("coordinate_y").doubleValue()
            );

    private static final RowMapper<SessionRow> SESSION_ROW_MAPPER =
            (rs, rowNum) -> new SessionRow(
                    (UUID) rs.getObject("id"),
                    (UUID) rs.getObject("warehouse_id"),
                    (UUID) rs.getObject("graph_id"),
                    (UUID) rs.getObject("worker_id"),
                    (UUID) rs.getObject("task_id"),
                    (UUID) rs.getObject("order_id"),
                    rs.getString("operation_type"),
                    rs.getString("vehicle_type"),
                    rs.getString("status"),
                    rs.getInt("route_version"),
                    rs.getString("start_node_id"),
                    rs.getString("current_node_id"),
                    rs.getString("end_node_id"),
                    decimal(rs, "total_distance_m"),
                    decimal(rs, "estimated_travel_seconds"),
                    decimal(rs, "total_wait_seconds"),
                    rs.getObject("lease_expires_at", OffsetDateTime.class),
                    rs.getObject("updated_at", OffsetDateTime.class)
            );

    private static double decimal(ResultSet rs, String column) throws SQLException {
        BigDecimal value = rs.getBigDecimal(column);
        return value == null ? 0 : value.doubleValue();
    }

    private record DbLocation(
            String locationCode,
            String area,
            String row,
            String bay,
            String locationType,
            String zoneType,
            double x,
            double y
    ) {}

    private record DoubleRange(double min, double max) {}

    private record RackSeed(
            String id,
            String area,
            String row,
            String bay,
            double x,
            double y,
            List<String> locationCodes
    ) {}

    private record NodeDef(
            String id,
            String type,
            String label,
            double x,
            double y,
            Map<String, Object> metadata
    ) {}

    private record EdgeDef(
            String id,
            String from,
            String to,
            String resourceKey,
            String type,
            double distanceM,
            double widthM
    ) {}

    private record AccessDef(
            String locationCode,
            String accessNodeId,
            String side,
            double approachDistanceM,
            boolean preferred
    ) {}

    private record BuiltGraph(
            String layoutVersion,
            List<NodeDef> nodes,
            List<EdgeDef> edges,
            List<AccessDef> access,
            List<RackFootprint> racks
    ) {}

    private record GraphHeader(
            UUID id,
            UUID warehouseId,
            String datasetVersion,
            String layoutVersion,
            String graphHash,
            int rackFootprintCount
    ) {}

    private record GraphData(
            WarehouseGraph graph,
            Map<String, GraphNode> nodes,
            Map<String, List<GraphEdge>> adjacency,
            Map<String, List<String>> accessByLocation
    ) {}

    private record StopChoice(
            String locationCode,
            String accessNodeId,
            double distanceM
    ) {}

    private record OrderedStop(String locationCode, String accessNodeId) {}

    private record SearchState(
            String nodeId,
            OffsetDateTime arrival,
            double estimatedEpochSeconds
    ) {}

    private record SearchParent(
            String previousNode,
            GraphEdge edge,
            OffsetDateTime departed,
            OffsetDateTime arrived
    ) {}

    private record DistanceState(String nodeId, double distance) {}

    private record ReservationWindow(
            UUID sessionId,
            String resourceKey,
            OffsetDateTime from,
            OffsetDateTime until
    ) {}

    private record PathStep(
            GraphEdge edge,
            OffsetDateTime departed,
            OffsetDateTime arrived
    ) {}

    private record PathResult(
            List<PathStep> steps,
            OffsetDateTime arrival,
            double distanceM,
            double waitSeconds
    ) {}

    private record PlannedRoute(
            List<PathStep> steps,
            double totalDistanceM,
            double estimatedTravelSeconds,
            double totalWaitSeconds
    ) {}

    private record SessionRow(
            UUID id,
            UUID warehouseId,
            UUID graphId,
            UUID workerId,
            UUID taskId,
            UUID orderId,
            String operationType,
            String vehicleType,
            String status,
            int routeVersion,
            String startNodeId,
            String currentNodeId,
            String endNodeId,
            double totalDistanceM,
            double estimatedTravelSeconds,
            double totalWaitSeconds,
            OffsetDateTime leaseExpiresAt,
            OffsetDateTime updatedAt
    ) {}
}
