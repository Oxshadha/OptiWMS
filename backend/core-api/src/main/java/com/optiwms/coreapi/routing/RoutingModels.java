package com.optiwms.coreapi.routing;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public final class RoutingModels {
    private RoutingModels() {}

    public record Coordinate(double x, double y) {}

    public record GraphNode(
            String id,
            String type,
            String label,
            double x,
            double y,
            Map<String, Object> metadata
    ) {}

    public record GraphEdge(
            String id,
            String from,
            String to,
            String resourceKey,
            String type,
            double distanceM,
            double baseTravelSeconds,
            double widthM,
            int capacity
    ) {}

    public record RackFootprint(
            String rackId,
            String area,
            String row,
            String bay,
            double centerX,
            double centerY,
            double widthM,
            double depthM,
            List<String> accessNodeIds
    ) {}

    public record WarehouseGraph(
            UUID graphId,
            UUID warehouseId,
            String datasetVersion,
            String layoutVersion,
            String graphHash,
            int rackFootprintCount,
            List<GraphNode> nodes,
            List<GraphEdge> edges,
            List<RackFootprint> racks
    ) {}

    public record CreateRouteRequest(
            String warehouseId,
            String workerId,
            String taskId,
            String orderId,
            String operationType,
            String vehicleType,
            List<String> locationCodes,
            String startNodeId,
            String endNodeId
    ) {}

    public record RouteProgressRequest(
            Integer routeVersion,
            String eventType,
            String nodeId,
            String locationCode,
            String clientEventId
    ) {}

    public record RouteStop(
            UUID id,
            int sequence,
            String locationCode,
            String accessNodeId,
            String status,
            OffsetDateTime completedAt
    ) {}

    public record RouteLeg(
            int sequence,
            String edgeId,
            String fromNodeId,
            String toNodeId,
            Coordinate from,
            Coordinate to,
            OffsetDateTime reservedFrom,
            OffsetDateTime reservedUntil,
            double distanceM,
            double waitSeconds,
            String status
    ) {}

    public record RouteSession(
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
            OffsetDateTime updatedAt,
            List<RouteStop> stops,
            List<RouteLeg> route
    ) {}

    public record RoutingEvent(
            long id,
            UUID sessionId,
            UUID warehouseId,
            UUID workerId,
            String eventType,
            String nodeId,
            String locationCode,
            Integer routeVersion,
            Map<String, Object> payload,
            OffsetDateTime createdAt
    ) {}

    public record RoutingStats(
            UUID warehouseId,
            UUID graphId,
            String graphHash,
            String datasetVersion,
            int nodeCount,
            int edgeCount,
            int rackFootprints,
            int activeSessions,
            int reservedResources,
            int waitingSessions,
            int expiredSessions
    ) {}
}
