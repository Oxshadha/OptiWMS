package com.optiwms.coreapi.ai;

import com.optiwms.coreapi.ai.dto.AiBoostingOnlineInferenceRequest;
import com.optiwms.coreapi.ai.dto.AiBoostingOnlineInferenceResponse;
import com.optiwms.infra.users.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AiProxyServiceTest {

    @Mock
    private RestTemplate restTemplate;

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private AiProxyService service;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(service, "forecastBaseUrl", "http://localhost:8091");
        ReflectionTestUtils.setField(service, "authToken", "");
    }

    @Test
    void inferBoostingOnline_shouldForwardExpectedPathAndPayload() {
        AiBoostingOnlineInferenceRequest payload = new AiBoostingOnlineInferenceRequest(
                "A",
                "XGBOOST",
                1,
                "production",
                true,
                List.of(
                        new AiBoostingOnlineInferenceRequest.SeriesPayload(
                                "sku_001",
                                "FG001",
                                "Soap",
                                List.of(
                                        new AiBoostingOnlineInferenceRequest.HistoryPoint("2025-01", 100.0, null, null, null, null, null, null, null, null, null, null),
                                        new AiBoostingOnlineInferenceRequest.HistoryPoint("2025-02", 120.0, null, null, null, null, null, null, null, null, null, null)
                                ),
                                Map.of("warehouse_id", "W1")
                        )
                )
        );

        AiBoostingOnlineInferenceResponse expected = new AiBoostingOnlineInferenceResponse(
                "A",
                "XGBOOST",
                1,
                "production",
                1,
                List.of(new AiBoostingOnlineInferenceResponse.Item("sku_001", "FG001", "Soap", 123.45, 1, false, null, null)),
                List.of(),
                false,
                null,
                0,
                Map.of("model_version", "v1")
        );

        when(restTemplate.exchange(
                eq("http://localhost:8091/artifacts/infer-boosting-online"),
                eq(HttpMethod.POST),
                any(HttpEntity.class),
                eq(AiBoostingOnlineInferenceResponse.class)
        )).thenReturn(new ResponseEntity<>(expected, HttpStatus.OK));

        ResponseEntity<AiBoostingOnlineInferenceResponse> result = service.inferBoostingOnline(payload);
        assertEquals(HttpStatus.OK, result.getStatusCode());
        assertEquals("XGBOOST", result.getBody().modelName());

        ArgumentCaptor<HttpEntity<AiBoostingOnlineInferenceRequest>> captor = ArgumentCaptor.forClass(HttpEntity.class);
        verify(restTemplate).exchange(
                eq("http://localhost:8091/artifacts/infer-boosting-online"),
                eq(HttpMethod.POST),
                captor.capture(),
                eq(AiBoostingOnlineInferenceResponse.class)
        );
        assertEquals(payload, captor.getValue().getBody());
        assertEquals(MediaType.APPLICATION_JSON, captor.getValue().getHeaders().getContentType());
    }

    @Test
    void inferBoostingOnline_smokeFlowShouldExposeFallbackFlagsWhenModelMissing() {
        AiBoostingOnlineInferenceRequest payload = new AiBoostingOnlineInferenceRequest(
                "A",
                "NON_EXISTENT_MODEL",
                1,
                "production",
                true,
                List.of(
                        new AiBoostingOnlineInferenceRequest.SeriesPayload(
                                "sku_001",
                                "FG001",
                                "Soap",
                                List.of(
                                        new AiBoostingOnlineInferenceRequest.HistoryPoint("2025-01", 100.0, null, null, null, null, null, null, null, null, null, null),
                                        new AiBoostingOnlineInferenceRequest.HistoryPoint("2025-02", 120.0, null, null, null, null, null, null, null, null, null, null)
                                ),
                                Map.of()
                        ),
                        new AiBoostingOnlineInferenceRequest.SeriesPayload(
                                "sku_002",
                                "FG002",
                                "Lotion/Cream",
                                List.of(
                                        new AiBoostingOnlineInferenceRequest.HistoryPoint("2025-01", 80.0, null, null, null, null, null, null, null, null, null, null),
                                        new AiBoostingOnlineInferenceRequest.HistoryPoint("2025-02", 95.0, null, null, null, null, null, null, null, null, null, null)
                                ),
                                Map.of()
                        )
                )
        );

        AiBoostingOnlineInferenceResponse expected = new AiBoostingOnlineInferenceResponse(
                "A",
                "NON_EXISTENT_MODEL",
                1,
                "production",
                2,
                List.of(
                        new AiBoostingOnlineInferenceResponse.Item("sku_001", "FG001", "Soap", 120.0, 1, true, "model_load_or_metadata_error: missing artifact", "last_value"),
                        new AiBoostingOnlineInferenceResponse.Item("sku_002", "FG002", "Lotion/Cream", 95.0, 1, true, "model_load_or_metadata_error: missing artifact", "last_value")
                ),
                List.of(new AiBoostingOnlineInferenceResponse.ErrorItem("*", "model_load_or_metadata_error: missing artifact")),
                true,
                "model_load_or_metadata_error: missing artifact",
                2,
                Map.of()
        );

        when(restTemplate.exchange(
                eq("http://localhost:8091/artifacts/infer-boosting-online"),
                eq(HttpMethod.POST),
                any(HttpEntity.class),
                eq(AiBoostingOnlineInferenceResponse.class)
        )).thenReturn(new ResponseEntity<>(expected, HttpStatus.OK));

        ResponseEntity<AiBoostingOnlineInferenceResponse> result = service.inferBoostingOnline(payload);
        assertEquals(HttpStatus.OK, result.getStatusCode());
        assertEquals(2, result.getBody().count());
        assertEquals(true, result.getBody().fallbackUsed());
        assertEquals(2, result.getBody().fallbackCount());
        assertEquals(true, result.getBody().items().get(0).fallbackUsed());
        assertEquals("last_value", result.getBody().items().get(0).baselineMethod());
    }
}
