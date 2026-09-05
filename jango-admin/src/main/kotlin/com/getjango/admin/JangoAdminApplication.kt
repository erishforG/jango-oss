package com.getjango.admin

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.autoconfigure.domain.EntityScan
import org.springframework.boot.runApplication
import org.springframework.data.jpa.repository.config.EnableJpaRepositories

@SpringBootApplication(
    scanBasePackages = ["com.getjango"],
)
@EntityScan(basePackages = ["com.getjango"])
@EnableJpaRepositories(basePackages = ["com.getjango"])
class JangoAdminApplication

fun main(args: Array<String>) {
    runApplication<JangoAdminApplication>(*args)
}
