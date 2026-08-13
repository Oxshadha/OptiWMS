package com.optiwms.coreapi.auth;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.ContentCachingResponseWrapper;

import java.io.IOException;
import java.util.concurrent.TimeUnit;

@Component
public class RateLimitingFilter extends OncePerRequestFilter {

    // Rate limit: 5 attempts per minute per IP
    private static final int MAX_ATTEMPTS = 5;
    private static final int MAX_ASSISTANT_REQUESTS = 60;
    private static final long WINDOW_DURATION_MINUTES = 1;

    private final Cache<String, Integer> attemptCache = Caffeine.newBuilder()
            .expireAfterWrite(WINDOW_DURATION_MINUTES, TimeUnit.MINUTES)
            .maximumSize(10_000)
            .build();

    private final Cache<String, Integer> assistantRequestCache = Caffeine.newBuilder()
            .expireAfterWrite(WINDOW_DURATION_MINUTES, TimeUnit.MINUTES)
            .maximumSize(10_000)
            .build();

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain)
            throws ServletException, IOException {

        if (request.getRequestURI().startsWith("/api/v1/assistant/")) {
            String clientKey = getClientIpAddress(request);
            Integer requests = assistantRequestCache.getIfPresent(clientKey);
            if (requests != null && requests >= MAX_ASSISTANT_REQUESTS) {
                response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
                response.setContentType("application/json");
                response.getWriter().write("{\"message\":\"Assistant request limit exceeded. Try again shortly.\"}");
                return;
            }
            assistantRequestCache.put(clientKey, requests == null ? 1 : requests + 1);
            filterChain.doFilter(request, response);
            return;
        }

        // Apply stricter brute-force protection to the login endpoint.
        if (request.getRequestURI().equals("/api/auth/login") && "POST".equals(request.getMethod())) {
            String clientIp = getClientIpAddress(request);
            Integer attempts = attemptCache.getIfPresent(clientIp);

            if (attempts != null && attempts >= MAX_ATTEMPTS) {
                response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
                response.setContentType("application/json");
                response.getWriter()
                        .write("{\"success\":false,\"message\":\"Too many login attempts. Please try again later.\"}");
                return;
            }

            // Wrap response to capture status code
            ContentCachingResponseWrapper wrappedResponse = new ContentCachingResponseWrapper(response);

            try {
                filterChain.doFilter(request, wrappedResponse);

                // Check response status after filter chain
                int statusCode = wrappedResponse.getStatus();
                if (statusCode == 401 || statusCode == 429) {
                    // Increment on failed attempts
                    attemptCache.put(clientIp, (attempts == null ? 0 : attempts) + 1);
                } else if (statusCode == 200) {
                    // Reset on successful login
                    attemptCache.invalidate(clientIp);
                }

                // Copy response body
                wrappedResponse.copyBodyToResponse();
            } finally {
                wrappedResponse.copyBodyToResponse();
            }
        } else {
            filterChain.doFilter(request, response);
        }
    }

    private String getClientIpAddress(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isEmpty()) {
            return xForwardedFor.split(",")[0].trim();
        }
        String xRealIp = request.getHeader("X-Real-IP");
        if (xRealIp != null && !xRealIp.isEmpty()) {
            return xRealIp;
        }
        return request.getRemoteAddr();
    }
}
