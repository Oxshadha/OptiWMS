package com.optiwms.coreapi.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
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

    @Value("${ai.putaway-http.connect-timeout-seconds:2}")
    private int putawayConnectTimeoutSeconds;

    @Value("${ai.putaway-http.read-timeout-seconds:3}")
    private int putawayReadTimeoutSeconds;

    @Bean
    @Primary
    public RestTemplate restTemplate() {
        return createRestTemplate(connectTimeoutSeconds, readTimeoutSeconds);
    }

    /** Short timeout used only by optional putaway AI enhancement. */
    @Bean("putawayAiRestTemplate")
    public RestTemplate putawayAiRestTemplate() {
        return createRestTemplate(putawayConnectTimeoutSeconds, putawayReadTimeoutSeconds);
    }

    private RestTemplate createRestTemplate(int connectSeconds, int readSeconds) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout((int) TimeUnit.SECONDS.toMillis(connectSeconds));
        factory.setReadTimeout((int) TimeUnit.SECONDS.toMillis(readSeconds));
        return new RestTemplate(factory);
    }
}
