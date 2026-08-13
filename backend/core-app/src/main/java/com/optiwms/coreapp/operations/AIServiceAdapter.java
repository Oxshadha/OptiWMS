package com.optiwms.coreapp.operations;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.util.Optional;
import java.util.UUID;

/**
 * AI Service Adapter
 * 
 * Centralized adapter for AI microservices.
 * Provides graceful degradation when services are unavailable.
 * 
 * Architecture:
 * - Non-blocking calls (timeout after 2 seconds)
 * - Returns Optional.empty() if service unavailable
 * - Core WMS continues with rule-based fallback
 */
@Component
public class AIServiceAdapter {

    private static final Logger logger = LoggerFactory.getLogger(AIServiceAdapter.class);
    
    @Value("${ai.services.base-url:http://localhost:8081}")
    private String aiServicesBaseUrl;
    
    @Value("${ai.services.enabled:false}")
    private boolean aiServicesEnabled;
    
    @Value("${ai.services.timeout:2000}")
    private int timeoutMs;
    
    private final RestTemplate restTemplate;

    public AIServiceAdapter(@Qualifier("putawayAiRestTemplate") RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    /**
     * Suggest optimal storage location using AI service
     * 
     * Returns Optional.empty() if:
     * - AI services disabled
     * - Service unavailable
     * - Timeout
     * - Any error
     * 
     * This allows graceful fallback to rule-based suggestions.
     */
    public Optional<LocationSuggestionService.LocationSuggestion> suggestOptimalStorage(
            UUID warehouseId,
            UUID materialId,
            Integer quantity,
            String materialType) {
        
        if (!aiServicesEnabled) {
            logger.debug("AI services disabled, skipping AI suggestion");
            return Optional.empty();
        }
        
        try {
            String url = String.format("%s/optimal-storage/suggest", aiServicesBaseUrl);
            
            // Create a new OptimalStorageRequest with the required parameters
            OptimalStorageRequest request = new OptimalStorageRequest(
                warehouseId.toString(),
                materialId.toString(),
                quantity,
                materialType
            );
            
            // Non-blocking call with timeout
            OptimalStorageResponse response = restTemplate.postForObject(
                url, request, OptimalStorageResponse.class);
            
            if (response != null && response.success && response.locationCode != null) {
                logger.info("AI service suggested location: {}", response.locationCode);
                return Optional.of(new LocationSuggestionService.LocationSuggestion(
                    response.locationCode,
                    response.reason != null ? response.reason : "AI-optimized location",
                    true
                ));
            }
            
        } catch (RestClientException e) {
            logger.warn("AI service unavailable: {}", e.getMessage());
        } catch (Exception e) {
            logger.error("Error calling AI service: {}", e.getMessage());
        }
        
        return Optional.empty();
    }

    /**
     * Check if AI service is available
     */
    public boolean isAIServiceAvailable() {
        if (!aiServicesEnabled) {
            return false;
        }
        
        try {
            String healthUrl = String.format("%s/health", aiServicesBaseUrl);
            String response = restTemplate.getForObject(healthUrl, String.class);
            return response != null && response.contains("UP");
        } catch (Exception e) {
            return false;
        }
    }

    // Request/Response DTOs
    private static class OptimalStorageRequest {
        public String warehouseId;
        public String materialId;
        public Integer quantity;
        public String materialType;

        public OptimalStorageRequest(String warehouseId, String materialId, Integer quantity, String materialType) {
            this.warehouseId = warehouseId;
            this.materialId = materialId;
            this.quantity = quantity;
            this.materialType = materialType;
        }
    }

    private static class OptimalStorageResponse {
        public boolean success;
        public String locationCode;
        public String reason;
    }
}
