package com.optiwms.infra.sops;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface SopRepository extends JpaRepository<SopEntity, UUID> {
    List<SopEntity> findByCategoryOrderByUpdatedAtDesc(String category);
    List<SopEntity> findByStatusOrderByUpdatedAtDesc(String status);
    List<SopEntity> findByCategoryAndStatusOrderByUpdatedAtDesc(String category, String status);
    List<SopEntity> findAllByOrderByUpdatedAtDesc();
}
