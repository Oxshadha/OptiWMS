package com.optiwms.coreapi.assistant;

import com.optiwms.coreapi.ai.AiProxyService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class AssistantToolControllerTest {
    private AssistantToolService tools;
    private AiProxyService scope;
    private MockMvc mvc;

    @BeforeEach
    void setup() {
        tools = org.mockito.Mockito.mock(AssistantToolService.class);
        scope = org.mockito.Mockito.mock(AiProxyService.class);
        mvc = MockMvcBuilders.standaloneSetup(new AssistantToolController(tools, scope)).build();
    }

    @Test
    void skuOutlookUsesAuthorizedWarehouseAndReturnsTraceableEnvelope() throws Exception {
        UUID authorized = UUID.randomUUID();
        when(scope.resolveWarehouseScope(null, "prompt-warehouse")).thenReturn(authorized.toString());
        when(tools.skuOutlook(authorized, "RM-0001", 12, "corr-1")).thenReturn(Map.of(
                "asOf", "2026-08-13T10:00:00Z", "warehouse", authorized,
                "datasetVersion", AssistantToolService.DATASET_VERSION,
                "modelName", AssistantToolService.MODEL,
                "facts", Map.of("sku", "RM-0001", "unit", "EA"),
                "warnings", List.of(), "sourceRecordReferences", List.of("materials:1"),
                "correlationId", "corr-1"));

        mvc.perform(get("/api/v1/assistant/tools/sku-outlook")
                        .param("warehouse", "prompt-warehouse").param("sku", "RM-0001")
                        .header("X-Correlation-ID", "corr-1"))
                .andExpect(status().isOk())
                .andExpect(header().string("X-Correlation-ID", "corr-1"))
                .andExpect(jsonPath("$.warehouse").value(authorized.toString()))
                .andExpect(jsonPath("$.modelName").value(AssistantToolService.MODEL))
                .andExpect(jsonPath("$.facts.sku").value("RM-0001"));

        verify(scope).resolveWarehouseScope(null, "prompt-warehouse");
        verify(tools).skuOutlook(authorized, "RM-0001", 12, "corr-1");
    }

    @Test
    void absentAuthorizedWarehouseIsRejectedBeforeToolExecution() throws Exception {
        when(scope.resolveWarehouseScope(null, "other")).thenReturn(null);
        mvc.perform(get("/api/v1/assistant/tools/inventory-risks").param("warehouse", "other"))
                .andExpect(status().isBadRequest());
    }
}
