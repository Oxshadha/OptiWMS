package com.optiwms.infra.operations;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface StockTransferLineRepository extends JpaRepository<StockTransferLineEntity, UUID> {
    List<StockTransferLineEntity> findByTransferIdOrderByLineNumberAsc(UUID transferId);
    List<StockTransferLineEntity> findByAssignedWorkerIdAndStatusIn(UUID assignedWorkerId, List<String> statuses);
    List<StockTransferLineEntity> findByStatusIn(List<String> statuses);
}
