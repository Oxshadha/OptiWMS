package com.optiwms.infra;

import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

@Configuration
@EntityScan(basePackages = "com.optiwms.infra")
@EnableJpaRepositories(basePackages = "com.optiwms.infra")
public class InfraConfig {
    // JPA repositories are enabled in OptiWmsApplication
    // This config class is for infrastructure-specific beans
}


