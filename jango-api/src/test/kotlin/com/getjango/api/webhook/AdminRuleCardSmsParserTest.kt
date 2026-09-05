package com.getjango.api.webhook

import com.getjango.core.rule.AdminRule
import com.getjango.core.rule.AdminRuleRepository
import com.getjango.core.rule.AdminRuleScope
import com.getjango.core.rule.AdminRuleStatus
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles

@SpringBootTest
@ActiveProfiles("test")
class AdminRuleCardSmsParserTest {
    @Autowired
    lateinit var adminRuleRepository: AdminRuleRepository

    @Autowired
    lateinit var parser: AdminRuleCardSmsParser

    @BeforeEach
    fun setUp() {
        adminRuleRepository.deleteAll()
        adminRuleRepository.saveAll(
            listOf(
                AdminRule(
                    name = "카드 SMS 파싱 - SHINHAN",
                    description = null,
                    scope = AdminRuleScope.CARD_ISSUER,
                    issuer = "SHINHAN",
                    conditionJson =
                        """{"type":"regex","pattern":"신한카드\\(\\d{4}\\)승인[\\s\\S]*?(?<amount>\\d[\\d,]*)원(?:\\((?<installment>[^)]+)\\))?(?<approvedAt>\\d{2}/\\d{2} \\d{2}:\\d{2})\\s*(?<merchant>.+?)(?:\\s|$)"}""",
                    actionJson = """{"defaults":{"installment":"일시불"}}""",
                    status = AdminRuleStatus.ACTIVE,
                ),
                AdminRule(
                    name = "카드 SMS 파싱 - LOTTE",
                    description = null,
                    scope = AdminRuleScope.CARD_ISSUER,
                    issuer = "LOTTE",
                    conditionJson =
                        """{"type":"regex","pattern":"(?<merchant>.+?)\\s+(?<amount>\\d[\\d,]*)원\\s*승인[\\s\\S]*?롯데0\\*\\d\\*\\s*(?<installment>\\S+)?\\s*(?<approvedAt>\\d{2}/\\d{2} \\d{2}:\\d{2})"}""",
                    actionJson = """{"defaults":{"installment":"일시불"}}""",
                    status = AdminRuleStatus.ACTIVE,
                ),
                AdminRule(
                    name = "카드 SMS 파싱 - HANA_CHECK",
                    description = null,
                    scope = AdminRuleScope.CARD_ISSUER,
                    issuer = "HANA_CHECK",
                    conditionJson =
                        """{"type":"regex","pattern":"하나0\\*\\d\\*체크승인[\\s\\S]*?(?<amount>\\d[\\d,]*)원(?<approvedAt>\\d{2}/\\d{2} \\d{2}:\\d{2})\\s*(?<merchant>.+?)(?:\\s|$)"}""",
                    actionJson = """{"defaults":{"installment":"일시불"}}""",
                    status = AdminRuleStatus.ACTIVE,
                ),
                AdminRule(
                    name = "카드 SMS 파싱 - KB",
                    description = null,
                    scope = AdminRuleScope.CARD_ISSUER,
                    issuer = "KB",
                    conditionJson =
                        """{"type":"regex","pattern":"KB(?:국민)?카드[\\s\\S]*?(?<amount>\\d[\\d,]*)원\\s*(?:\\((?<installment>[^)]+)\\))?[\\s\\S]*?(?<approvedAt>\\d{2}/\\d{2} \\d{2}:\\d{2})\\s*(?<merchant>.+?)(?:\\s|$)"}""",
                    actionJson = """{"defaults":{"installment":"일시불"}}""",
                    status = AdminRuleStatus.ACTIVE,
                ),
                AdminRule(
                    name = "카드 SMS 파싱 - SAMSUNG",
                    description = null,
                    scope = AdminRuleScope.CARD_ISSUER,
                    issuer = "SAMSUNG",
                    conditionJson =
                        """{"type":"regex","pattern":"삼성(?:카드)?[\\s\\S]*?(?<amount>\\d[\\d,]*)원\\s*(?:\\((?<installment>[^)]+)\\))?[\\s\\S]*?(?<approvedAt>\\d{2}/\\d{2} \\d{2}:\\d{2})\\s*(?<merchant>.+?)(?:\\s|$)"}""",
                    actionJson = """{"defaults":{"installment":"일시불"}}""",
                    status = AdminRuleStatus.ACTIVE,
                ),
                AdminRule(
                    name = "카드 SMS 파싱 - HYUNDAI",
                    description = null,
                    scope = AdminRuleScope.CARD_ISSUER,
                    issuer = "HYUNDAI",
                    conditionJson =
                        """{"type":"regex","pattern":"현대(?:카드)?M?\\s*승인\\s*(?:(?<maskedConsumerName>[가-힣]\\*[가-힣])\\s*)?[\\s\\S]*?(?<amount>\\d[\\d,]*)원(?:\\s*\\(?(?<installment>일시불|\\d+개월)\\)?)?[\\s\\S]*?(?<approvedAt>\\d{2}/\\d{2}\\s+\\d{2}:\\d{2})\\s*(?<merchant>[^\\r\\n]+?)(?=\\s*(?:\\r?\\n|누적[\\d,]+원|$))"}""",
                    actionJson = """{"defaults":{"installment":"일시불"}}""",
                    status = AdminRuleStatus.ACTIVE,
                ),
                AdminRule(
                    name = "카드 SMS 파싱 - WOORI",
                    description = null,
                    scope = AdminRuleScope.CARD_ISSUER,
                    issuer = "WOORI",
                    conditionJson =
                        """{"type":"regex","pattern":"우리(?:카드)?[\\s\\S]*?(?<amount>\\d[\\d,]*)원\\s*(?:\\((?<installment>[^)]+)\\))?[\\s\\S]*?(?<approvedAt>\\d{2}/\\d{2} \\d{2}:\\d{2})\\s*(?<merchant>.+?)(?:\\s|$)"}""",
                    actionJson = """{"defaults":{"installment":"일시불"}}""",
                    status = AdminRuleStatus.ACTIVE,
                ),
                AdminRule(
                    name = "카드 SMS 파싱 - NH",
                    description = null,
                    scope = AdminRuleScope.CARD_ISSUER,
                    issuer = "NH",
                    conditionJson =
                        """{"type":"regex","pattern":"(?:NH|농협)(?:카드)?[\\s\\S]*?(?<amount>\\d[\\d,]*)원\\s*(?:\\((?<installment>[^)]+)\\))?[\\s\\S]*?(?<approvedAt>\\d{2}/\\d{2} \\d{2}:\\d{2})\\s*(?<merchant>.+?)(?:\\s|$)"}""",
                    actionJson = """{"defaults":{"installment":"일시불"}}""",
                    status = AdminRuleStatus.ACTIVE,
                ),
                AdminRule(
                    name = "카드 SMS 파싱 - BC",
                    description = null,
                    scope = AdminRuleScope.CARD_ISSUER,
                    issuer = "BC",
                    conditionJson =
                        """{"type":"regex","pattern":"BC(?:카드)?[\\s\\S]*?(?<amount>\\d[\\d,]*)원\\s*(?:\\((?<installment>[^)]+)\\))?[\\s\\S]*?(?<approvedAt>\\d{2}/\\d{2} \\d{2}:\\d{2})\\s*(?<merchant>.+?)(?:\\s|$)"}""",
                    actionJson = """{"defaults":{"installment":"일시불"}}""",
                    status = AdminRuleStatus.ACTIVE,
                ),
            ),
        )
    }

    @Test
    fun `parses SHINHAN sample message`() {
        val message = "신한카드(8020)승인 안내 8,000원(일시불)02/21 12:10 백산주유소"

        val parsed = parser.parse(message)
        assertNotNull(parsed)
        assertEquals("SHINHAN", parsed!!.issuer)
        assertEquals("8000", parsed.amount.toPlainString())
        assertEquals("백산주유소", parsed.merchant)
        assertEquals("02/21 12:10", parsed.approvedAt)
        assertEquals("일시불", parsed.installment)
    }

    @Test
    fun `parses LOTTE sample message`() {
        val message = "로프트 하우스 14,000원 승인 롯데0*1* 일시불 02/21 12:48"

        val parsed = parser.parse(message)
        assertNotNull(parsed)
        assertEquals("LOTTE", parsed!!.issuer)
        assertEquals("14000", parsed.amount.toPlainString())
        assertEquals("로프트 하우스", parsed.merchant)
        assertEquals("02/21 12:48", parsed.approvedAt)
        assertEquals("일시불", parsed.installment)
    }

    @Test
    fun `parses HANA_CHECK sample message with default installment`() {
        val message = "하나0*0*체크승인 국내승인 62,400원02/19 11:37 신세계남산"

        val parsed = parser.parse(message)
        assertNotNull(parsed)
        assertEquals("HANA_CHECK", parsed!!.issuer)
        assertEquals("62400", parsed.amount.toPlainString())
        assertEquals("신세계남산", parsed.merchant)
        assertEquals("02/19 11:37", parsed.approvedAt)
        assertEquals("일시불", parsed.installment)
    }

    @Test
    fun `parses extended issuers`() {
        val samples =
            listOf(
                Triple("KB카드 승인 12,300원(3개월) 02/21 09:10 네이버", "KB", "3개월"),
                Triple("삼성카드 결제 24,500원 02/21 10:15 스타벅스", "SAMSUNG", "일시불"),
                Triple("현대카드 승인 45,000원 02/21 11:20 쿠팡", "HYUNDAI", "일시불"),
                Triple("우리카드 승인 8,900원 02/21 12:00 올리브영", "WOORI", "일시불"),
                Triple("NH카드 승인 39,000원 02/21 13:30 GS25", "NH", "일시불"),
                Triple("BC카드 승인 17,000원 02/21 14:10 다이소", "BC", "일시불"),
            )

        samples.forEach { (message, issuer, installment) ->
            val parsed = parser.parse(message)
            assertNotNull(parsed)
            assertEquals(issuer, parsed!!.issuer)
            assertEquals(installment, parsed.installment)
        }
    }

    @Test
    fun `parses Hyundai Card M approvals with masked consumers without treating cumulative amount as transaction`() {
        val samples =
            listOf(
                """
                현대카드M 승인
                이*림
                33,500원 일시불
                08/07 23:44
                (주)우아한형제들
                누적1,849,300원
                """.trimIndent() to listOf("이*림", "33500", "일시불", "08/07 23:44", "(주)우아한형제들"),
                """
                현대카드M 승인
                신*석
                4,900원 일시불
                08/07 11:29
                네이버플러스멤버십
                누적1,781,500원
                """.trimIndent() to listOf("신*석", "4900", "일시불", "08/07 11:29", "네이버플러스멤버십"),
            )

        samples.forEach { (message, expected) ->
            val parsed = parser.parse(message)
            assertNotNull(parsed)
            assertEquals("HYUNDAI", parsed!!.issuer)
            assertEquals(expected[0], parsed.maskedConsumerName)
            assertEquals(expected[1], parsed.amount.toPlainString())
            assertEquals(expected[2], parsed.installment)
            assertEquals(expected[3], parsed.approvedAt)
            assertEquals(expected[4], parsed.merchant)
        }
    }
}
