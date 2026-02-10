package com.optiwms.infra.sops;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface SopRepository extends JpaRepository<SopEntity, UUID> {
    List<SopEntity> findByCategoryIgnoreCaseOrderByUpdatedAtDesc(String category);

    List<SopEntity> findByStatusIgnoreCaseOrderByUpdatedAtDesc(String status);

    List<SopEntity> findByCategoryIgnoreCaseAndStatusIgnoreCaseOrderByUpdatedAtDesc(String category, String status);

    List<SopEntity> findAllByOrderByUpdatedAtDesc();
}
