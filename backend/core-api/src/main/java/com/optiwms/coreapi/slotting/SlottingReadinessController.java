package com.optiwms.coreapi.slotting;

import com.optiwms.coreapp.slotting.SlottingReadinessService;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/slotting/readiness")
public class SlottingReadinessController {

    private final SlottingReadinessService readinessService;

    public SlottingReadinessController(SlottingReadinessService readinessService) {
        this.readinessService = readinessService;
    }

    @GetMapping
    public ReadinessDto getReadiness(@RequestParam UUID warehouseId) {
        SlottingReadinessService.ReadinessReport report = readinessService.assess(warehouseId);
        return new ReadinessDto(
                report.ready(),
                report.materialsReadyPct(),
                report.materialsReadyCount(),
                report.materialsTotalCount(),
                report.locationsReadyPct(),
                report.locationsReadyCount(),
                report.locationsTotalCount(),
                report.blockers());
    }

    public record ReadinessDto(
            boolean ready,
            double materialsReadyPct,
            int materialsReadyCount,
            int materialsTotalCount,
            double locationsReadyPct,
            int locationsReadyCount,
            int locationsTotalCount,
            List<String> blockers) {}
}
