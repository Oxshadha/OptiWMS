package com.optiwms.coreapi.config;

import com.optiwms.coreapi.auth.CustomUserDetailsService;
import com.optiwms.coreapi.auth.JwtAuthenticationFilter;
import com.optiwms.coreapi.auth.RateLimitingFilter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final CustomUserDetailsService userDetailsService;
    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final RateLimitingFilter rateLimitingFilter;
    private final SecurityHeadersFilter securityHeadersFilter;

    @Value("${frontend.url:http://localhost:3000}")
    private String frontendUrl;

    public SecurityConfig(
            CustomUserDetailsService userDetailsService, 
            JwtAuthenticationFilter jwtAuthenticationFilter, 
            RateLimitingFilter rateLimitingFilter,
            SecurityHeadersFilter securityHeadersFilter) {
        this.userDetailsService = userDetailsService;
        this.jwtAuthenticationFilter = jwtAuthenticationFilter;
        this.rateLimitingFilter = rateLimitingFilter;
        this.securityHeadersFilter = securityHeadersFilter;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12); // Strength 12 for better security
    }

    @Bean
    public DaoAuthenticationProvider authenticationProvider() {
        DaoAuthenticationProvider authProvider = new DaoAuthenticationProvider();
        authProvider.setUserDetailsService(userDetailsService);
        authProvider.setPasswordEncoder(passwordEncoder());
        return authProvider;
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration authConfig) throws Exception {
        return authConfig.getAuthenticationManager();
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .csrf(csrf -> csrf.disable()) // Disabled for stateless JWT authentication
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/actuator/**").permitAll()
                        .requestMatchers("/api/auth/login", "/api/auth/refresh", "/api/auth/register").permitAll()
                        // Allow authenticated users to access their own preferences
                        .requestMatchers("/api/auth/me/**").authenticated()
                        // Role-based access control
                        .requestMatchers("/api/users/**").hasAnyRole("ADMIN", "WAREHOUSE_MANAGER")
                        .requestMatchers("/api/sops/**").hasAnyRole("ADMIN", "WAREHOUSE_MANAGER", "INBOUND_COORDINATOR")
                        .requestMatchers("/api/integration/**").hasRole("ADMIN")
                        .requestMatchers("/api/integration/locations/generate/**").hasRole("ADMIN")
                        // Allow workers to read materials by code (for SKU lookup in receiving)
                        .requestMatchers(HttpMethod.GET, "/api/master/materials/code/**").authenticated()
                        // Allow all authenticated users to read warehouses (needed for worker warehouse assignment)
                        .requestMatchers(HttpMethod.GET, "/api/master/warehouses").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/master/warehouses/{id}").authenticated()
                        // Allow workers to read locations (needed for putaway location validation)
                        // CRITICAL: These must come BEFORE the general /api/master/** rule to take precedence
                        // Support both route patterns for compatibility
                        .requestMatchers(HttpMethod.GET, "/api/master/locations/**").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/master/locations/code/**").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/locations/**").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/locations/code/**").authenticated()
                        // Other master data operations require admin/manager roles
                        .requestMatchers("/api/master/**").hasAnyRole("ADMIN", "WAREHOUSE_MANAGER", "INBOUND_COORDINATOR")
                        .requestMatchers("/api/**").authenticated()
                        .anyRequest().permitAll()
                )
                .authenticationProvider(authenticationProvider())
                // Order matters: Security Headers → Rate Limiting → JWT Auth
                .addFilterBefore(securityHeadersFilter, UsernamePasswordAuthenticationFilter.class)
                .addFilterBefore(rateLimitingFilter, UsernamePasswordAuthenticationFilter.class)
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);
        
        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        
        // Use environment variable for production, fallback to localhost for development
        String allowedOrigin = frontendUrl;
        if (allowedOrigin == null || allowedOrigin.isEmpty()) {
            allowedOrigin = "http://localhost:3000";
        }
        
        configuration.setAllowedOrigins(List.of(allowedOrigin));
        configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"));
        configuration.setAllowedHeaders(List.of("*"));
        configuration.setAllowCredentials(true);
        configuration.setMaxAge(3600L);
        
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", configuration);
        return source;
    }
}

