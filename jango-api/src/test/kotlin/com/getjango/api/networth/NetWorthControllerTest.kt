package com.getjango.api.networth

import com.getjango.api.ledger.LedgerAccessService
import com.getjango.core.transaction.EntryRepository
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.ArgumentMatchers.any
import org.mockito.ArgumentMatchers.anyLong
import org.mockito.ArgumentMatchers.isNull
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import java.time.LocalDate

class NetWorthControllerTest {
    private lateinit var entryRepository: EntryRepository
    private lateinit var ledgerAccessService: LedgerAccessService
    private lateinit var mockMvc: MockMvc

    @BeforeEach
    fun setUp() {
        entryRepository = mock(EntryRepository::class.java)
        ledgerAccessService = mock(LedgerAccessService::class.java)

        `when`(ledgerAccessService.resolveLedgerId(isNull())).thenReturn(1L)
        `when`(entryRepository.findSignedTypeTotalsByLedgerUntil(anyLong(), anyLocalDate())).thenReturn(emptyList())
        `when`(
            entryRepository.findMonthlyBalanceSheetAmountsByLedgerBetween(
                anyLong(),
                anyLocalDate(),
                anyLocalDate(),
            ),
        ).thenReturn(emptyList())

        mockMvc =
            MockMvcBuilders
                .standaloneSetup(NetWorthController(NetWorthService(entryRepository), ledgerAccessService))
                .build()
    }

    @Test
    fun `GET networth uses default 12 month history`() {
        mockMvc
            .get("/api/reports/networth")
            .andExpect {
                status { isOk() }
                jsonPath("$.currentNetWorth") { value(0.0) }
                jsonPath("$.history.length()") { value(12) }
            }
    }

    @Test
    fun `GET networth clamps requested months to public 1-24 range`() {
        mockMvc
            .get("/api/reports/networth?months=0")
            .andExpect {
                status { isOk() }
                jsonPath("$.history.length()") { value(1) }
            }

        mockMvc
            .get("/api/reports/networth?months=99")
            .andExpect {
                status { isOk() }
                jsonPath("$.history.length()") { value(24) }
            }
    }

    private fun anyLocalDate(): LocalDate {
        any(LocalDate::class.java)
        return LocalDate.MIN
    }
}
