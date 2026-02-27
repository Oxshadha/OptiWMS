package com.optiwms.infra.operations;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface StockTransferRepository extends JpaRepository<StockTransferEntity, UUID>, JpaSpecificationExecutor<StockTransferEntity> {
    Optional<StockTransferEntity> findByTransferNumber(String transferNumber);
    List<StockTransferEntity> findByStatus(String status);
    List<StockTransferEntity> findByTransferType(String transferType);
}
