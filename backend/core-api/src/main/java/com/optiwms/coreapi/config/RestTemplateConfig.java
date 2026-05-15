package com.optiwms.coreapi.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;

import java.util.concurrent.TimeUnit;

/**
 * RestTemplate Configuration for AI Service Adapter
 * 
 * Configured with timeout to prevent blocking core WMS operations
 */
@Configuration
public class RestTemplateConfig {

    @Value("${ai.http.connect-timeout-seconds:3}")
    private int connectTimeoutSeconds;

    @Value("${ai.http.read-timeout-seconds:120}")
    private int readTimeoutSeconds;

    @Bean
    public RestTemplate restTemplate() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        
        // Set timeouts to prevent blocking
        factory.setConnectTimeout((int) TimeUnit.SECONDS.toMillis(connectTimeoutSeconds));
        factory.setReadTimeout((int) TimeUnit.SECONDS.toMillis(readTimeoutSeconds));
        
        return new RestTemplate(factory);
    }
}
