package com.optiwms.coreapi.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
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

    @Bean
    public RestTemplate restTemplate() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        
        // Set timeouts to prevent blocking
        factory.setConnectTimeout((int) TimeUnit.SECONDS.toMillis(2));
        factory.setReadTimeout((int) TimeUnit.SECONDS.toMillis(2));
        
        return new RestTemplate(factory);
    }
}
