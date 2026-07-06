package com.optiwms.infra.orders;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface OrderNumberAliasRepository extends JpaRepository<OrderNumberAliasEntity, UUID> {
    Optional<OrderNumberAliasEntity> findByAliasOrderNumber(String aliasOrderNumber);
    boolean existsByAliasOrderNumber(String aliasOrderNumber);
}
