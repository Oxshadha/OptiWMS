package com.optiwms.coreapi.slotting;

import com.optiwms.coreapp.slotting.SlottingGaProxyService;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/slotting/ga")
public class SlottingGaController {

    private final SlottingGaProxyService gaProxyService;

    public SlottingGaController(SlottingGaProxyService gaProxyService) {
        this.gaProxyService = gaProxyService;
    }

    @PostMapping("/optimize")
    public Map<String, Object> optimize(@RequestBody GaOptimizeDto body) {
        return gaProxyService.optimize(new SlottingGaProxyService.GaOptimizeRequest(
                body.warehouseId(),
                body.populationSize(),
                body.generations(),
                body.mutationRate()));
    }

    public record GaOptimizeDto(
            String warehouseId,
            Integer populationSize,
            Integer generations,
            Double mutationRate) {}
}
