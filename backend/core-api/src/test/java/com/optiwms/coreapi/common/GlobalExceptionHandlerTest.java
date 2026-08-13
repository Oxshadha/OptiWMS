package com.optiwms.coreapi.common;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import static org.junit.jupiter.api.Assertions.assertEquals;

class GlobalExceptionHandlerTest {
    @Test
    void unknownApiRoutesReturnNotFoundInsteadOfInternalServerError() {
        GlobalExceptionHandler handler = new GlobalExceptionHandler();
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/query-sql");

        var response = handler.handleNoResource(
                new NoResourceFoundException(HttpMethod.GET, "/api/query-sql"), request);

        assertEquals(404, response.getStatusCode().value());
        assertEquals("Endpoint not found", response.getBody().message());
    }
}
