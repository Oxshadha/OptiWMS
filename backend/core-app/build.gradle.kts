dependencies {
    implementation(project(":core-domain"))
    implementation(project(":infra"))
    implementation("org.springframework.boot:spring-boot-starter")
    implementation("org.springframework.boot:spring-boot-starter-data-jpa")
    implementation("org.springframework.boot:spring-boot-starter-security")
    // Annotations only. The slotting-service response contract is deserialized here;
    // tolerating unknown fields stops a Python-side addition from breaking Java at runtime.
    implementation("com.fasterxml.jackson.core:jackson-annotations")
}


