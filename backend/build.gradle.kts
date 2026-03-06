plugins {
    id("java")
    id("io.spring.dependency-management") version "1.1.5"
    id("org.springframework.boot") version "3.3.0" apply false
}

java {
    sourceCompatibility = JavaVersion.VERSION_21
}

allprojects {
    group = "com.optiwms"
    version = "0.1.0-SNAPSHOT"

    repositories {
        mavenCentral()
    }
}

subprojects {
    apply(plugin = "java")
    apply(plugin = "io.spring.dependency-management")

    dependencyManagement {
        imports {
            mavenBom("org.springframework.boot:spring-boot-dependencies:3.3.0")
        }
    }

    // Prefer newer Flyway to support PostgreSQL 16.x server versions.
    configurations.all {
        resolutionStrategy.eachDependency {
            if (requested.group == "org.flywaydb" && requested.name == "flyway-core") {
                useVersion("10.21.0")
                because("Flyway 10.21 supports PostgreSQL 16.x")
            }
        }
    }

    dependencies {
        testImplementation("org.junit.jupiter:junit-jupiter-api:5.10.2")
        testRuntimeOnly("org.junit.jupiter:junit-jupiter-engine:5.10.2")
        testImplementation("org.mockito:mockito-core:5.12.0")
    }

    tasks.test {
        useJUnitPlatform()
    }
}

project(":core-api") {
    apply(plugin = "org.springframework.boot")
    
    // Spring Boot will auto-detect the main class from @SpringBootApplication annotation
    // No explicit configuration needed - Spring Boot plugin handles this automatically

    dependencies {
        implementation(project(":core-app"))
        implementation(project(":core-domain"))
        implementation(project(":infra"))
        implementation(project(":integration"))
        implementation("org.springframework.boot:spring-boot-starter-web")
        implementation("org.springframework.boot:spring-boot-starter-data-jpa")
        implementation("org.springframework.boot:spring-boot-starter-security")
        implementation("org.springframework.boot:spring-boot-starter-validation")
        implementation("org.springframework.boot:spring-boot-starter-actuator")
        // JWT dependencies
        implementation("io.jsonwebtoken:jjwt-api:0.12.3")
        implementation("io.jsonwebtoken:jjwt-impl:0.12.3")
        implementation("io.jsonwebtoken:jjwt-jackson:0.12.3")
        // Rate limiting
        implementation("com.github.ben-manes.caffeine:caffeine:3.1.8")
    }
}

project(":core-app") {
    dependencies {
        implementation(project(":core-domain"))
        implementation("org.springframework.boot:spring-boot-starter")
        implementation("org.apache.pdfbox:pdfbox:2.0.32")
    }
}

project(":core-domain") {
    // pure domain module, no Spring dependencies by default
}

project(":infra") {
    dependencies {
        implementation(project(":core-domain"))
        implementation("org.springframework.boot:spring-boot-starter-data-jpa")
        implementation("org.postgresql:postgresql:42.7.3")
        // Flyway version is managed by resolution strategy in subprojects
        implementation("org.flywaydb:flyway-core")
        implementation("org.flywaydb:flyway-database-postgresql")
    }
}

project(":integration") {
    dependencies {
        implementation(project(":core-app"))
        implementation(project(":infra"))
        implementation("org.springframework.boot:spring-boot-starter")
        implementation("org.springframework.boot:spring-boot-starter-data-jpa")
        implementation("org.springframework.boot:spring-boot-starter-webflux")
    }
}

// Root-level task to run the application (delegates to core-api)
tasks.register("bootRun") {
    dependsOn(":core-api:bootRun")
    group = "application"
    description = "Runs the Spring Boot application"
}
