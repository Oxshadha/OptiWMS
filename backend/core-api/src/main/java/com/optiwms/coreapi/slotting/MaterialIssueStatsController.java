package com.optiwms.coreapi.slotting;

import com.optiwms.coreapp.slotting.MaterialIssueStatsService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/slotting/issue-stats")
public class MaterialIssueStatsController {

    private final MaterialIssueStatsService issueStatsService;

    public MaterialIssueStatsController(MaterialIssueStatsService issueStatsService) {
        this.issueStatsService = issueStatsService;
    }

    @PostMapping("/refresh")
    public ResponseEntity<Map<String, String>> refresh(@RequestParam UUID warehouseId) {
        OffsetDateTime refreshedAt = issueStatsService.refreshForWarehouse(warehouseId);
        return ResponseEntity.ok(Map.of(
                "warehouseId", warehouseId.toString(),
                "refreshedAt", refreshedAt.toString()));
    }
}
