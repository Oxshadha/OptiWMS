plugins {
    id("java")
    id("org.springframework.boot") version "3.3.0"
    id("io.spring.dependency-management") version "1.1.5"
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
    }

    tasks.test {
        useJUnitPlatform()
    }
}

project(":core-api") {
    apply(plugin = "org.springframework.boot")

    dependencies {
        implementation(project(":core-app"))
        implementation(project(":core-domain"))
        implementation(project(":infra"))
        implementation("org.springframework.boot:spring-boot-starter-web")
        implementation("org.springframework.boot:spring-boot-starter-data-jpa")
        implementation("org.springframework.boot:spring-boot-starter-security")
        implementation("org.springframework.boot:spring-boot-starter-validation")
        implementation("org.springframework.boot:spring-boot-starter-actuator")
    }
}

project(":core-app") {
    dependencies {
        implementation(project(":core-domain"))
        implementation("org.springframework.boot:spring-boot-starter")
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
        implementation("org.flywaydb:flyway-core:10.16.0")
    }
}

project(":integration") {
    dependencies {
        implementation(project(":core-app"))
        implementation("org.springframework.boot:spring-boot-starter-webflux")
    }
}


