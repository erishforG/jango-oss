package com.getjango.api.config

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.springframework.web.bind.annotation.RequestMapping

class SpaControllerTest {
    private val controller = SpaController()

    @Test
    fun `public SEO routes forward to route-specific HTML`() {
        assertEquals("forward:/seo/login.html", controller.login())
        assertEquals("forward:/seo/help.html", controller.help())
        assertEquals("forward:/seo/privacy.html", controller.privacy())
        assertEquals("forward:/seo/terms.html", controller.terms())
    }

    @Test
    fun `other SPA routes keep using the app shell`() {
        assertEquals("forward:/index.html", controller.forward())
    }

    @Test
    fun `SPA catch-all does not intercept generated SEO assets`() {
        val patterns =
            SpaController::class
                .java
                .getDeclaredMethod("forward")
                .getAnnotation(RequestMapping::class.java)
                .value

        assertTrue(patterns.any { it.contains("seo") })
    }
}
