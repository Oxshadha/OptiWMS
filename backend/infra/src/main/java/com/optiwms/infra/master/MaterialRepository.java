package com.optiwms.infra.master;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface MaterialRepository extends JpaRepository<MaterialEntity, UUID> {
    Optional<MaterialEntity> findByMaterialCode(String materialCode);
    
    // Case-insensitive lookup for material code
    @Query("SELECT m FROM MaterialEntity m WHERE LOWER(TRIM(m.materialCode)) = LOWER(TRIM(:materialCode))")
    Optional<MaterialEntity> findByMaterialCodeIgnoreCase(@Param("materialCode") String materialCode);
    
    boolean existsByMaterialCode(String materialCode);
    java.util.List<MaterialEntity> findByMaterialType(String materialType);
    List<MaterialEntity> findByMaterialCodeContainingIgnoreCaseOrDescriptionContainingIgnoreCase(String materialCode, String description);
}
