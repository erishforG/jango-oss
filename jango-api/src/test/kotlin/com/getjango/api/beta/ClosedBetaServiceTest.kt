package com.getjango.api.beta

import com.getjango.core.user.AppSetting
import com.getjango.core.user.AppSettingRepository
import com.getjango.core.user.BetaInvite
import com.getjango.core.user.BetaInviteRepository
import com.getjango.core.user.User
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import org.springframework.transaction.annotation.Transactional

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class ClosedBetaServiceTest {
    @Autowired
    lateinit var closedBetaService: ClosedBetaService

    @Autowired
    lateinit var appSettingRepository: AppSettingRepository

    @Autowired
    lateinit var betaInviteRepository: BetaInviteRepository

    @Test
    fun `allows any email when closed beta is disabled`() {
        appSettingRepository.save(AppSetting(key = "closed_beta_enabled", value = "false"))

        assertTrue(closedBetaService.isAllowedEmail("someone@jango.app"))
    }

    @Test
    fun `requires invited email when closed beta is enabled`() {
        appSettingRepository.save(AppSetting(key = "closed_beta_enabled", value = "true"))
        betaInviteRepository.save(BetaInvite(email = "service-invited@jango.app"))

        assertTrue(closedBetaService.isAllowedEmail("service-invited@jango.app"))
        assertFalse(closedBetaService.isAllowedEmail("blocked@jango.app"))
    }

    @Test
    fun `allows admin user even when not invited in closed beta`() {
        appSettingRepository.save(AppSetting(key = "closed_beta_enabled", value = "true"))

        assertTrue(closedBetaService.isAllowedUser(User(email = "admin@jango.app", role = "admin")))
        assertFalse(closedBetaService.isAllowedUser(User(email = "user@jango.app", role = "user")))
    }
}
