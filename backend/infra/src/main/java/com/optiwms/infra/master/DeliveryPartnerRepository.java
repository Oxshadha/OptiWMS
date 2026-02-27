package com.optiwms.infra.master;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface DeliveryPartnerRepository extends JpaRepository<DeliveryPartnerEntity, UUID>, JpaSpecificationExecutor<DeliveryPartnerEntity> {
    Optional<DeliveryPartnerEntity> findByPartnerCode(String partnerCode);
    List<DeliveryPartnerEntity> findByStatus(String status);
    List<DeliveryPartnerEntity> findByCompanyNameContainingIgnoreCase(String companyName);
}
