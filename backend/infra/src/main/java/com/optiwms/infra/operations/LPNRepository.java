package com.optiwms.infra.operations;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface LPNRepository extends JpaRepository<LPNEntity, UUID> {
    Optional<LPNEntity> findByLpnCode(String lpnCode);
    
    // Get the most recently created LPN for sequential generation
    List<LPNEntity> findAllByOrderByCreatedAtDesc(Pageable pageable);
}
