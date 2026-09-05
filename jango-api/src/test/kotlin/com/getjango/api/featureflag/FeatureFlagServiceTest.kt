package com.getjango.api.featureflag

import com.getjango.core.featureflag.FeatureFlag
import com.getjango.core.featureflag.FeatureFlagRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.mockito.Mockito
import java.util.Optional

class FeatureFlagServiceTest {
    @Test
    fun `isEnabled returns false for missing flags`() {
        val featureFlagRepository = Mockito.mock(FeatureFlagRepository::class.java)
        val featureFlagService = FeatureFlagService(featureFlagRepository)
        Mockito.`when`(featureFlagRepository.findById("missing_flag")).thenReturn(Optional.empty())

        assertFalse(featureFlagService.isEnabled("missing_flag"))
        assertNull(featureFlagService.get("missing_flag"))
    }

    @Test
    fun `setEnabled creates new flag with audit metadata`() {
        val featureFlagRepository = Mockito.mock(FeatureFlagRepository::class.java)
        val featureFlagService = FeatureFlagService(featureFlagRepository)
        Mockito.`when`(featureFlagRepository.findById("new_dashboard")).thenReturn(Optional.empty())
        Mockito.`when`(featureFlagRepository.save(Mockito.any(FeatureFlag::class.java))).thenAnswer { it.arguments[0] }

        val flag =
            featureFlagService.setEnabled(
                name = "new_dashboard",
                enabled = true,
                updatedBy = "admin@example.com",
                description = "Visibility dashboard rollout",
            )

        assertTrue(flag.enabled)
        assertEquals("Visibility dashboard rollout", flag.description)
        assertEquals("admin@example.com", flag.updatedBy)
        assertNotNull(flag.updatedAt)
        Mockito.verify(featureFlagRepository).save(flag)
    }

    @Test
    fun `setEnabled updates existing flag and preserves description when omitted`() {
        val featureFlagRepository = Mockito.mock(FeatureFlagRepository::class.java)
        val featureFlagService = FeatureFlagService(featureFlagRepository)
        val existing =
            FeatureFlag(
                name = "monthly_report_enabled",
                enabled = true,
                description = "Monthly report rollout",
                updatedBy = "first-admin",
            )
        Mockito.`when`(featureFlagRepository.findById("monthly_report_enabled")).thenReturn(Optional.of(existing))
        Mockito.`when`(featureFlagRepository.save(Mockito.any(FeatureFlag::class.java))).thenAnswer { it.arguments[0] }

        val updated =
            featureFlagService.setEnabled(
                name = "monthly_report_enabled",
                enabled = false,
                updatedBy = "second-admin",
            )

        assertFalse(updated.enabled)
        assertEquals("Monthly report rollout", updated.description)
        assertEquals("second-admin", updated.updatedBy)
        Mockito.verify(featureFlagRepository).save(existing)
    }

    @Test
    fun `setEnabled updates description when provided`() {
        val featureFlagRepository = Mockito.mock(FeatureFlagRepository::class.java)
        val featureFlagService = FeatureFlagService(featureFlagRepository)
        val existing =
            FeatureFlag(
                name = "monthly_report_enabled",
                enabled = false,
                description = "Old description",
                updatedBy = "first-admin",
            )
        Mockito.`when`(featureFlagRepository.findById("monthly_report_enabled")).thenReturn(Optional.of(existing))
        Mockito.`when`(featureFlagRepository.save(Mockito.any(FeatureFlag::class.java))).thenAnswer { it.arguments[0] }

        val updated =
            featureFlagService.setEnabled(
                name = "monthly_report_enabled",
                enabled = true,
                updatedBy = "second-admin",
                description = "New description",
            )

        assertTrue(updated.enabled)
        assertEquals("New description", updated.description)
        assertEquals("second-admin", updated.updatedBy)
        Mockito.verify(featureFlagRepository).save(existing)
    }

    @Test
    fun `listAll returns flags sorted by name`() {
        val featureFlagRepository = Mockito.mock(FeatureFlagRepository::class.java)
        val featureFlagService = FeatureFlagService(featureFlagRepository)
        Mockito.`when`(featureFlagRepository.findAll()).thenReturn(
            listOf(
                FeatureFlag(name = "zeta"),
                FeatureFlag(name = "alpha"),
            ),
        )

        val result = featureFlagService.listAll()

        assertEquals(listOf("alpha", "zeta"), result.map { it.name })
    }

    @Test
    fun `get returns existing flag`() {
        val featureFlagRepository = Mockito.mock(FeatureFlagRepository::class.java)
        val featureFlagService = FeatureFlagService(featureFlagRepository)
        val existing =
            FeatureFlag(
                name = "monthly_report_enabled",
                enabled = true,
            )
        Mockito.`when`(featureFlagRepository.findById("monthly_report_enabled")).thenReturn(Optional.of(existing))

        assertEquals(existing, featureFlagService.get("monthly_report_enabled"))
    }
}
