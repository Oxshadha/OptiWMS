package com.optiwms.coreapi.auth;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.junit.jupiter.api.Assertions.assertEquals;

class RateLimitingFilterTest {
    @Test
    void assistantToolsAreLimitedPerClientWindow() throws Exception {
        RateLimitingFilter filter = new RateLimitingFilter();

        for (int requestNumber = 0; requestNumber < 60; requestNumber++) {
            MockHttpServletResponse response = invoke(filter);
            assertEquals(200, response.getStatus());
        }

        MockHttpServletResponse limited = invoke(filter);
        assertEquals(429, limited.getStatus());
    }

    private MockHttpServletResponse invoke(RateLimitingFilter filter) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/assistant/tools/sku-outlook");
        request.setRemoteAddr("192.0.2.10");
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request, response, new MockFilterChain());
        return response;
    }
}
