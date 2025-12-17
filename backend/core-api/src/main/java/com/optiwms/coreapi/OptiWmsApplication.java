package com.optiwms.coreapi;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

@SpringBootApplication(scanBasePackages = "com.optiwms")
@EntityScan(basePackages = "com.optiwms.infra")
@EnableJpaRepositories(basePackages = "com.optiwms.infra")
public class OptiWmsApplication {

    public static void main(String[] args) {
        SpringApplication.run(OptiWmsApplication.class, args);
    }
}


