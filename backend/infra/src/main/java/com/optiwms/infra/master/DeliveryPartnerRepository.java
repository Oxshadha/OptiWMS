package com.optiwms.infra.master;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface DeliveryPartnerRepository extends JpaRepository<DeliveryPartnerEntity, UUID> {
    Optional<DeliveryPartnerEntity> findByCode(String code);
    boolean existsByCode(String code);
}

