package com.getjango.api.config

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.stereotype.Controller
import org.springframework.web.bind.annotation.RequestMapping

@Controller
@ConditionalOnProperty(name = ["jango.spa.enabled"], havingValue = "true", matchIfMissing = true)
class SpaController {
    @RequestMapping(value = ["/login", "/login/"])
    fun login(): String = "forward:/seo/login.html"

    @RequestMapping(value = ["/help", "/help/"])
    fun help(): String = "forward:/seo/help.html"

    @RequestMapping(value = ["/privacy", "/privacy/"])
    fun privacy(): String = "forward:/seo/privacy.html"

    @RequestMapping(value = ["/terms", "/terms/"])
    fun terms(): String = "forward:/seo/terms.html"

    @RequestMapping(
        value = [
            "/",
            "/{path:^(?!api|actuator|assets|error|seo)[^.]*$}",
            "/{path:^(?!api|actuator|assets|error|seo)[^.]*$}/**",
        ],
    )
    fun forward(): String = "forward:/index.html"
}
