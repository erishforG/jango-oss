plugins {
    kotlin("plugin.jpa")
}

dependencies {
    api(project(":jango-common"))

    implementation("org.springframework.boot:spring-boot-starter-data-jpa")
    implementation("org.springframework.boot:spring-boot-starter-validation")
    implementation("org.springframework.modulith:spring-modulith-starter-core")

    runtimeOnly("org.postgresql:postgresql")
    runtimeOnly("com.google.cloud:spring-cloud-gcp-starter-sql-postgresql:6.2.0")
    implementation("org.flywaydb:flyway-core")
    implementation("org.flywaydb:flyway-database-postgresql")

    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testImplementation("org.springframework.modulith:spring-modulith-starter-test")
    testRuntimeOnly("com.h2database:h2")
}
