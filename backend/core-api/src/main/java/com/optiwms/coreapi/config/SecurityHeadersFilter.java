package com.optiwms.coreapi.config;

import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;

import java.io.IOException;

/**
 * Security Headers Filter
 * 
 * Adds essential security headers to all HTTP responses to protect against:
 * - Cross-Site Scripting (XSS)
 * - Clickjacking
 * - MIME-sniffing attacks
 * - Information leakage
 * 
 * Based on OWASP recommendations and industry best practices.
 */
@Component
public class SecurityHeadersFilter implements Filter {

    private static final String ENVIRONMENT = System.getenv("ENVIRONMENT") != null ? 
                                              System.getenv("ENVIRONMENT") : "development";

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        
        HttpServletRequest httpRequest = (HttpServletRequest) request;
        HttpServletResponse httpResponse = (HttpServletResponse) response;

        // 1. Content Security Policy (CSP)
        // Prevents XSS attacks by controlling which resources can be loaded
        // Adjust based on your frontend needs
        String csp = "default-src 'self'; " +
                     "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " + // Allow inline scripts (Next.js needs this)
                     "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " + // Allow inline styles
                     "img-src 'self' data: https: blob:; " + // Allow images from self, data URIs, and HTTPS
                     "font-src 'self' data: https://fonts.gstatic.com; " + // Allow fonts
                     "connect-src 'self' http://localhost:8080 http://localhost:3000; " + // Allow API connections
                     "frame-ancestors 'none'; " + // Prevent embedding in iframes (same as X-Frame-Options DENY)
                     "base-uri 'self'; " + // Restrict base tag
                     "form-action 'self';"; // Restrict form submissions
        httpResponse.setHeader("Content-Security-Policy", csp);

        // 2. X-Frame-Options
        // Prevents clickjacking attacks by preventing the page from being embedded in frames
        httpResponse.setHeader("X-Frame-Options", "DENY");

        // 3. X-Content-Type-Options
        // Prevents MIME-sniffing, forces browser to respect declared Content-Type
        httpResponse.setHeader("X-Content-Type-Options", "nosniff");

        // 4. Strict-Transport-Security (HSTS)
        // Forces HTTPS connections (only in production with HTTPS enabled)
        if ("production".equalsIgnoreCase(ENVIRONMENT)) {
            httpResponse.setHeader("Strict-Transport-Security", 
                "max-age=31536000; includeSubDomains; preload"); // 1 year
        }

        // 5. X-XSS-Protection
        // Legacy header for older browsers, enables XSS filter
        httpResponse.setHeader("X-XSS-Protection", "1; mode=block");

        // 6. Referrer-Policy
        // Controls how much referrer information is included with requests
        httpResponse.setHeader("Referrer-Policy", "no-referrer-when-downgrade");

        // 7. Permissions-Policy (formerly Feature-Policy)
        // Disables unnecessary browser features
        String permissionsPolicy = "geolocation=(), " +
                                   "microphone=(), " +
                                   "camera=(), " +
                                   "payment=(), " +
                                   "usb=(), " +
                                   "magnetometer=(), " +
                                   "gyroscope=(), " +
                                   "accelerometer=()";
        httpResponse.setHeader("Permissions-Policy", permissionsPolicy);

        // 8. Cache-Control for sensitive endpoints
        // Prevent caching of sensitive data
        String path = httpRequest.getRequestURI();
        if (path.startsWith("/api/auth") || path.startsWith("/api/users")) {
            httpResponse.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
            httpResponse.setHeader("Pragma", "no-cache");
            httpResponse.setHeader("Expires", "0");
        }

        // 9. Remove server information header (security through obscurity)
        // Spring Boot adds "Server" header by default, we can't remove it here but can in application.properties:
        // server.server-header= (empty value)

        chain.doFilter(request, response);
    }

    @Override
    public void init(FilterConfig filterConfig) throws ServletException {
        // Initialization logic if needed
    }

    @Override
    public void destroy() {
        // Cleanup logic if needed
    }
}
