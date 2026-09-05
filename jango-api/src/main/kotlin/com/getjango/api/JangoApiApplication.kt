package com.getjango.api

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.autoconfigure.domain.EntityScan
import org.springframework.boot.runApplication
import org.springframework.data.jpa.repository.config.EnableJpaRepositories
import org.springframework.scheduling.annotation.EnableScheduling

@SpringBootApplication(
    scanBasePackages = ["com.getjango"],
)
@EntityScan(basePackages = ["com.getjango"])
@EnableJpaRepositories(basePackages = ["com.getjango"])
@EnableScheduling
class JangoApiApplication

fun main(args: Array<String>) {
    runApplication<JangoApiApplication>(*args)
}
