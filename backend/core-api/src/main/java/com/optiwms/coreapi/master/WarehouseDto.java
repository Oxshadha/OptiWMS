package com.optiwms.coreapi.master;

import java.util.UUID;

public record WarehouseDto(UUID id, String code, String name, String status) {
}


