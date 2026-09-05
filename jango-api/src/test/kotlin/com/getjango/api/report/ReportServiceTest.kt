package com.getjango.api.report

import com.getjango.core.account.Account
import com.getjango.core.account.AccountRepository
import com.getjango.core.account.AccountType
import com.getjango.core.ledger.Ledger
import com.getjango.core.ledger.LedgerRepository
import com.getjango.core.transaction.Entry
import com.getjango.core.transaction.EntryRepository
import com.getjango.core.transaction.EntryType
import com.getjango.core.transaction.Transaction
import com.getjango.core.transaction.TransactionRepository
import com.getjango.core.user.User
import com.getjango.core.user.UserRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import org.springframework.transaction.annotation.Transactional
import java.math.BigDecimal
import java.time.LocalDate
import java.time.YearMonth

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class ReportServiceTest {
    @Autowired
    lateinit var reportService: ReportService

    @Autowired
    lateinit var userRepository: UserRepository

    @Autowired
    lateinit var ledgerRepository: LedgerRepository

    @Autowired
    lateinit var accountRepository: AccountRepository

    @Autowired
    lateinit var transactionRepository: TransactionRepository

    @Autowired
    lateinit var entryRepository: EntryRepository

    @Test
    fun `balance sheet excludes group accounts from items`() {
        val user =
            userRepository.save(
                User(email = "report-test-${System.nanoTime()}@jango.local"),
            )
        val ledger = ledgerRepository.save(Ledger(user = user, name = "테스트 장부"))

        val assetGroup =
            accountRepository.save(
                Account(
                    ledger = ledger,
                    name = "자산 그룹",
                    type = AccountType.ASSET,
                    isGroup = true,
                ),
            )
        val assetLeaf =
            accountRepository.save(
                Account(
                    ledger = ledger,
                    parent = assetGroup,
                    name = "자산 하위",
                    type = AccountType.ASSET,
                ),
            )
        val liabilityGroup =
            accountRepository.save(
                Account(
                    ledger = ledger,
                    name = "부채 그룹",
                    type = AccountType.LIABILITY,
                    isGroup = true,
                ),
            )
        val liabilityLeaf =
            accountRepository.save(
                Account(
                    ledger = ledger,
                    parent = liabilityGroup,
                    name = "부채 하위",
                    type = AccountType.LIABILITY,
                ),
            )

        val tx1 =
            transactionRepository.save(
                Transaction(
                    ledger = ledger,
                    date = LocalDate.of(2026, 2, 1),
                    description = "leaf entry",
                ),
            )
        entryRepository.save(
            Entry(
                transaction = tx1,
                account = assetLeaf,
                type = EntryType.DR,
                amount = BigDecimal(100),
                currency = "KRW",
                baseAmount = BigDecimal(100),
            ),
        )
        entryRepository.save(
            Entry(
                transaction = tx1,
                account = liabilityLeaf,
                type = EntryType.CR,
                amount = BigDecimal(100),
                currency = "KRW",
                baseAmount = BigDecimal(100),
            ),
        )

        val tx2 =
            transactionRepository.save(
                Transaction(
                    ledger = ledger,
                    date = LocalDate.of(2026, 2, 2),
                    description = "group entry",
                ),
            )
        entryRepository.save(
            Entry(
                transaction = tx2,
                account = assetGroup,
                type = EntryType.DR,
                amount = BigDecimal(50),
                currency = "KRW",
                baseAmount = BigDecimal(50),
            ),
        )
        entryRepository.save(
            Entry(
                transaction = tx2,
                account = liabilityGroup,
                type = EntryType.CR,
                amount = BigDecimal(50),
                currency = "KRW",
                baseAmount = BigDecimal(50),
            ),
        )

        val result = reportService.getBalanceSheet(ledger.id, LocalDate.of(2026, 2, 28))

        // 그룹 포함해서 반환하되, total은 leaf만 합산
        val assetNames = result.assets.map { it.name }.toSet()
        assert(assetNames.contains("자산 하위"))
        assert(assetNames.contains("자산 그룹"))
        val liabilityNames = result.liabilities.map { it.name }.toSet()
        assert(liabilityNames.contains("부채 하위"))
        assert(liabilityNames.contains("부채 그룹"))
        // total은 leaf(!isGroup)만 합산 → 이중 계산 방지
        assertEquals(100.0, result.totalAssets)
        assertEquals(100.0, result.totalLiabilities)
    }

    @Test
    fun `cash flow classifies operating investing financing and cash balance`() {
        val user =
            userRepository.save(
                User(email = "report-cash-flow-${System.nanoTime()}@jango.local"),
            )
        val ledger = ledgerRepository.save(Ledger(user = user, name = "현금흐름 장부"))

        val checking =
            accountRepository.save(
                Account(
                    ledger = ledger,
                    name = "입출금 통장",
                    type = AccountType.ASSET,
                    subtype = "CHECKING",
                ),
            )
        val savings =
            accountRepository.save(
                Account(
                    ledger = ledger,
                    name = "적금",
                    type = AccountType.ASSET,
                    subtype = "SAVINGS",
                ),
            )
        val income =
            accountRepository.save(
                Account(
                    ledger = ledger,
                    name = "급여",
                    type = AccountType.INCOME,
                ),
            )
        val expense =
            accountRepository.save(
                Account(
                    ledger = ledger,
                    name = "식비",
                    type = AccountType.EXPENSE,
                ),
            )
        val loan =
            accountRepository.save(
                Account(
                    ledger = ledger,
                    name = "대출",
                    type = AccountType.LIABILITY,
                    subtype = "LOAN",
                ),
            )

        fun post(
            date: LocalDate,
            desc: String,
            left: Pair<Account, EntryType>,
            right: Pair<Account, EntryType>,
            amount: Long,
        ) {
            val tx =
                transactionRepository.save(
                    Transaction(ledger = ledger, date = date, description = desc),
                )
            entryRepository.save(
                Entry(
                    transaction = tx,
                    account = left.first,
                    type = left.second,
                    amount = BigDecimal(amount),
                    currency = "KRW",
                    baseAmount = BigDecimal(amount),
                ),
            )
            entryRepository.save(
                Entry(
                    transaction = tx,
                    account = right.first,
                    type = right.second,
                    amount = BigDecimal(amount),
                    currency = "KRW",
                    baseAmount = BigDecimal(amount),
                ),
            )
        }

        // 기초 현금 100,000
        post(LocalDate.of(2025, 12, 31), "기초", checking to EntryType.DR, loan to EntryType.CR, 100000)

        // 영업활동 +300,000 (수입), -50,000 (비용)
        post(LocalDate.of(2026, 1, 5), "급여", checking to EntryType.DR, income to EntryType.CR, 300000)
        post(LocalDate.of(2026, 1, 6), "식비", expense to EntryType.DR, checking to EntryType.CR, 50000)

        // 투자활동 -120,000 (적금으로 이동)
        post(LocalDate.of(2026, 1, 10), "적금이체", savings to EntryType.DR, checking to EntryType.CR, 120000)

        // 재무활동 -70,000 (대출 상환)
        post(LocalDate.of(2026, 1, 15), "대출상환", loan to EntryType.DR, checking to EntryType.CR, 70000)

        val result = reportService.getCashFlow(ledger.id, LocalDate.of(2026, 1, 1), LocalDate.of(2026, 1, 31))

        assertEquals(100000.0, result.beginningCash)
        assertEquals(250000.0, result.operating.net)
        assertEquals(0.0, result.investing.net)
        assertEquals(-70000.0, result.financing.net)
        assertEquals(180000.0, result.totalNetCashFlow)
        assertEquals(280000.0, result.endingCash)
    }

    @Test
    fun `consumer summary groups by consumer and supports direction filter with category breakdown`() {
        val user =
            userRepository.save(
                User(email = "report-consumer-${System.nanoTime()}@jango.local"),
            )
        val ledger = ledgerRepository.save(Ledger(user = user, name = "소비자 리포트 장부"))

        val food =
            accountRepository.save(
                Account(ledger = ledger, name = "식비", type = AccountType.EXPENSE),
            )
        val transport =
            accountRepository.save(
                Account(ledger = ledger, name = "교통비", type = AccountType.EXPENSE),
            )
        val salary =
            accountRepository.save(
                Account(ledger = ledger, name = "급여", type = AccountType.INCOME),
            )
        val cash =
            accountRepository.save(
                Account(ledger = ledger, name = "현금", type = AccountType.ASSET),
            )

        fun post(
            date: LocalDate,
            consumerUserId: Long?,
            consumerTag: String?,
            left: Pair<Account, EntryType>,
            right: Pair<Account, EntryType>,
            amount: Long,
        ) {
            val tx =
                transactionRepository.save(
                    Transaction(
                        ledger = ledger,
                        date = date,
                        consumerUserId = consumerUserId,
                        consumerTag = consumerTag,
                    ),
                )
            entryRepository.save(
                Entry(
                    transaction = tx,
                    account = left.first,
                    type = left.second,
                    amount = BigDecimal(amount),
                    currency = "KRW",
                    baseAmount = BigDecimal(amount),
                ),
            )
            entryRepository.save(
                Entry(
                    transaction = tx,
                    account = right.first,
                    type = right.second,
                    amount = BigDecimal(amount),
                    currency = "KRW",
                    baseAmount = BigDecimal(amount),
                ),
            )
        }

        val mom = userRepository.save(User(email = "report-mom-${System.nanoTime()}@jango.local"))
        val dad = userRepository.save(User(email = "report-dad-${System.nanoTime()}@jango.local"))

        post(LocalDate.of(2026, 2, 1), mom.id, "mom", food to EntryType.DR, cash to EntryType.CR, 30000)
        post(LocalDate.of(2026, 2, 2), mom.id, "mom", transport to EntryType.DR, cash to EntryType.CR, 10000)
        post(LocalDate.of(2026, 2, 3), mom.id, "mom", cash to EntryType.DR, salary to EntryType.CR, 200000)
        post(LocalDate.of(2026, 2, 4), dad.id, "dad", food to EntryType.DR, cash to EntryType.CR, 50000)
        post(LocalDate.of(2026, 2, 5), null, null, transport to EntryType.DR, cash to EntryType.CR, 5000)

        val bothDirections =
            reportService.getConsumerSummary(
                ledgerId = ledger.id,
                startDate = LocalDate.of(2026, 2, 1),
                endDate = LocalDate.of(2026, 2, 28),
                direction = null,
            )

        val momSummary = bothDirections.summaries.first { it.consumerUserId == mom.id }
        assertEquals(40000.0, momSummary.totalExpense)
        assertEquals(200000.0, momSummary.totalIncome)
        assertEquals("급여", momSummary.categoryBreakdown.first().accountName)
        assertEquals(95000.0, bothDirections.grandTotal.expense)
        assertEquals(200000.0, bothDirections.grandTotal.income)
        assertTrue(bothDirections.summaries.any { it.consumerUserId == null && it.consumerTag == null && it.displayName == "본인" })

        val expenseOnly =
            reportService.getConsumerSummary(
                ledgerId = ledger.id,
                startDate = LocalDate.of(2026, 2, 1),
                endDate = LocalDate.of(2026, 2, 28),
                direction = "EXPENSE",
            )

        val momExpenseSummary = expenseOnly.summaries.first { it.consumerUserId == mom.id }
        assertEquals(40000.0, momExpenseSummary.totalExpense)
        assertEquals(0.0, momExpenseSummary.totalIncome)
        assertEquals(2, momExpenseSummary.categoryBreakdown.size)
    }

    @Test
    fun `category trend returns top 10 expense accounts × months in sorted order`() {
        val user =
            userRepository.save(
                User(email = "report-category-trend-${System.nanoTime()}@jango.local"),
            )
        val ledger = ledgerRepository.save(Ledger(user = user, name = "카테고리 트렌드 장부"))

        val cash =
            accountRepository.save(
                Account(ledger = ledger, name = "현금", type = AccountType.ASSET),
            )
        val food =
            accountRepository.save(
                Account(ledger = ledger, name = "식비", type = AccountType.EXPENSE),
            )
        val transport =
            accountRepository.save(
                Account(ledger = ledger, name = "교통비", type = AccountType.EXPENSE),
            )
        val income =
            accountRepository.save(
                Account(ledger = ledger, name = "급여", type = AccountType.INCOME),
            )

        fun post(
            date: LocalDate,
            left: Pair<Account, EntryType>,
            right: Pair<Account, EntryType>,
            amount: Long,
        ) {
            val tx =
                transactionRepository.save(
                    Transaction(ledger = ledger, date = date, description = "tx"),
                )
            entryRepository.save(
                Entry(
                    transaction = tx,
                    account = left.first,
                    type = left.second,
                    amount = BigDecimal(amount),
                    currency = "KRW",
                    baseAmount = BigDecimal(amount),
                ),
            )
            entryRepository.save(
                Entry(
                    transaction = tx,
                    account = right.first,
                    type = right.second,
                    amount = BigDecimal(amount),
                    currency = "KRW",
                    baseAmount = BigDecimal(amount),
                ),
            )
        }

        // 2026-04: 식비 200,000
        post(LocalDate.of(2026, 4, 5), food to EntryType.DR, cash to EntryType.CR, 200000)
        // 2026-05: 식비 300,000 + 교통비 50,000
        post(LocalDate.of(2026, 5, 10), food to EntryType.DR, cash to EntryType.CR, 300000)
        post(LocalDate.of(2026, 5, 12), transport to EntryType.DR, cash to EntryType.CR, 50000)
        // 2026-06: 식비 100,000 + 교통비 70,000
        post(LocalDate.of(2026, 6, 1), food to EntryType.DR, cash to EntryType.CR, 100000)
        post(LocalDate.of(2026, 6, 2), transport to EntryType.DR, cash to EntryType.CR, 70000)
        // 수입(필터링되어야 함)
        post(LocalDate.of(2026, 6, 3), cash to EntryType.DR, income to EntryType.CR, 1_000_000)
        // 기간 밖 (필터링되어야 함)
        post(LocalDate.of(2025, 1, 1), food to EntryType.DR, cash to EntryType.CR, 999999)

        val result = reportService.getCategoryTrend(ledger.id, months = 3, endMonth = java.time.YearMonth.of(2026, 6))

        // months 배열: 시작월 → 종료월
        assertEquals(listOf("2026-04", "2026-05", "2026-06"), result.months)

        // 식비(총 600,000)가 교통비(총 120,000)보다 먼저
        assertEquals(2, result.categories.size)
        assertEquals("식비", result.categories[0].accountName)
        assertEquals("교통비", result.categories[1].accountName)

        // 식비 월별: 200,000 / 300,000 / 100,000
        assertEquals(listOf(200000.0, 300000.0, 100000.0), result.categories[0].values)
        assertEquals(600000.0, result.categories[0].total)

        // 교통비 월별: 0 / 50,000 / 70,000
        assertEquals(listOf(0.0, 50000.0, 70000.0), result.categories[1].values)
        assertEquals(120000.0, result.categories[1].total)

        // INCOME은 절대 결과에 포함되지 않음
        assertTrue(result.categories.none { it.accountName == "급여" })
    }

    @Test
    fun `category trend returns empty categories when no expense data in range`() {
        val user =
            userRepository.save(
                User(email = "report-category-trend-empty-${System.nanoTime()}@jango.local"),
            )
        val ledger = ledgerRepository.save(Ledger(user = user, name = "빈 카테고리 트렌드"))

        val result = reportService.getCategoryTrend(ledger.id, months = 12, endMonth = java.time.YearMonth.of(2026, 6))

        assertEquals(12, result.months.size)
        assertEquals("2026-06", result.months.last())
        assertEquals("2025-07", result.months.first())
        assertTrue(result.categories.isEmpty())
    }

    @Test
    fun `category trend limits result to top 10 accounts by total`() {
        val user =
            userRepository.save(
                User(email = "report-category-trend-top10-${System.nanoTime()}@jango.local"),
            )
        val ledger = ledgerRepository.save(Ledger(user = user, name = "Top10 장부"))

        val cash =
            accountRepository.save(
                Account(ledger = ledger, name = "현금", type = AccountType.ASSET),
            )

        // 12개의 EXPENSE 계정 생성, 각 계정에 서로 다른 합계 부여 (i*1000)
        val accounts =
            (1..12).map { i ->
                accountRepository.save(
                    Account(ledger = ledger, name = "카테고리$i", type = AccountType.EXPENSE),
                )
            }

        accounts.forEachIndexed { idx, acc ->
            val tx =
                transactionRepository.save(
                    Transaction(ledger = ledger, date = LocalDate.of(2026, 6, 1), description = "tx-$idx"),
                )
            val amount = ((idx + 1) * 1000).toLong()
            entryRepository.save(
                Entry(
                    transaction = tx,
                    account = acc,
                    type = EntryType.DR,
                    amount = BigDecimal(amount),
                    currency = "KRW",
                    baseAmount = BigDecimal(amount),
                ),
            )
            entryRepository.save(
                Entry(
                    transaction = tx,
                    account = cash,
                    type = EntryType.CR,
                    amount = BigDecimal(amount),
                    currency = "KRW",
                    baseAmount = BigDecimal(amount),
                ),
            )
        }

        val result = reportService.getCategoryTrend(ledger.id, months = 1, endMonth = java.time.YearMonth.of(2026, 6))

        // Top 10만 반환
        assertEquals(10, result.categories.size)
        // 합계 내림차순 → 카테고리12가 1위, 카테고리3이 10위
        assertEquals("카테고리12", result.categories.first().accountName)
        assertEquals("카테고리3", result.categories.last().accountName)
    }

    @Test
    fun `credit card report returns billing period and expected amount`() {
        val user =
            userRepository.save(
                User(email = "report-credit-card-${System.nanoTime()}@jango.local"),
            )
        val ledger = ledgerRepository.save(Ledger(user = user, name = "신용카드 리포트 장부"))

        val card =
            accountRepository.save(
                Account(
                    ledger = ledger,
                    name = "테스트카드",
                    type = AccountType.LIABILITY,
                    subtype = "CREDIT_CARD",
                    settlementDay = 14,
                    billingStartDay = 25,
                    billingDurationMonths = 1,
                ),
            )
        val expense =
            accountRepository.save(
                Account(
                    ledger = ledger,
                    name = "식비",
                    type = AccountType.EXPENSE,
                ),
            )

        val purchaseTx =
            transactionRepository.save(
                Transaction(
                    ledger = ledger,
                    date = LocalDate.of(2026, 1, 2),
                    description = "카드 결제",
                ),
            )
        entryRepository.save(
            Entry(
                transaction = purchaseTx,
                account = expense,
                type = EntryType.DR,
                amount = BigDecimal(30000),
                currency = "KRW",
                baseAmount = BigDecimal(30000),
            ),
        )
        entryRepository.save(
            Entry(
                transaction = purchaseTx,
                account = card,
                type = EntryType.CR,
                amount = BigDecimal(30000),
                currency = "KRW",
                baseAmount = BigDecimal(30000),
            ),
        )

        val prevTx =
            transactionRepository.save(
                Transaction(
                    ledger = ledger,
                    date = LocalDate.of(2025, 12, 28),
                    description = "전월 카드 결제",
                ),
            )
        entryRepository.save(
            Entry(
                transaction = prevTx,
                account = expense,
                type = EntryType.DR,
                amount = BigDecimal(10000),
                currency = "KRW",
                baseAmount = BigDecimal(10000),
            ),
        )
        entryRepository.save(
            Entry(
                transaction = prevTx,
                account = card,
                type = EntryType.CR,
                amount = BigDecimal(10000),
                currency = "KRW",
                baseAmount = BigDecimal(10000),
            ),
        )

        val result = reportService.getCreditCardReport(ledger.id, java.time.YearMonth.of(2026, 1))

        assertEquals(1, result.size)
        assertEquals("2025-12-25", result[0].billingPeriodStart)
        assertEquals("2026-01-24", result[0].billingPeriodEnd)
        assertEquals(40000.0, result[0].expectedAmount)
        assertEquals(40000.0, result[0].deltaFromPrev)
        assertTrue(result[0].transactions.any { it.description == "카드 결제" })
    }

    @Test
    fun `monthly trend backfills 12 months and preserves income expense net income`() {
        val user =
            userRepository.save(
                User(email = "report-monthly-trend-${System.nanoTime()}@jango.local"),
            )
        val ledger = ledgerRepository.save(Ledger(user = user, name = "월별 흐름 장부"))

        val bank =
            accountRepository.save(
                Account(
                    ledger = ledger,
                    name = "입출금 통장",
                    type = AccountType.ASSET,
                ),
            )
        val income =
            accountRepository.save(
                Account(
                    ledger = ledger,
                    name = "급여",
                    type = AccountType.INCOME,
                ),
            )
        val expense =
            accountRepository.save(
                Account(
                    ledger = ledger,
                    name = "생활비",
                    type = AccountType.EXPENSE,
                ),
            )

        fun post(
            date: LocalDate,
            desc: String,
            left: Pair<Account, EntryType>,
            right: Pair<Account, EntryType>,
            amount: Long,
        ) {
            val tx =
                transactionRepository.save(
                    Transaction(ledger = ledger, date = date, description = desc),
                )
            entryRepository.save(
                Entry(
                    transaction = tx,
                    account = left.first,
                    type = left.second,
                    amount = BigDecimal(amount),
                    currency = "KRW",
                    baseAmount = BigDecimal(amount),
                ),
            )
            entryRepository.save(
                Entry(
                    transaction = tx,
                    account = right.first,
                    type = right.second,
                    amount = BigDecimal(amount),
                    currency = "KRW",
                    baseAmount = BigDecimal(amount),
                ),
            )
        }

        post(LocalDate.of(2025, 4, 5), "4월 급여", bank to EntryType.DR, income to EntryType.CR, 3_000_000)
        post(LocalDate.of(2025, 4, 6), "4월 생활비", expense to EntryType.DR, bank to EntryType.CR, 1_200_000)
        post(LocalDate.of(2026, 2, 5), "2월 급여", bank to EntryType.DR, income to EntryType.CR, 2_500_000)
        post(LocalDate.of(2026, 2, 6), "2월 생활비", expense to EntryType.DR, bank to EntryType.CR, 2_900_000)
        post(LocalDate.of(2026, 3, 6), "3월 생활비", expense to EntryType.DR, bank to EntryType.CR, 400_000)

        val result = reportService.getMonthlyTrend(ledger.id, 12, YearMonth.of(2026, 3))

        assertEquals(12, result.size)
        assertEquals("2025-04", result.first().yearMonth)
        assertEquals("2026-03", result.last().yearMonth)

        val apr = result.single { it.yearMonth == "2025-04" }
        assertEquals(3_000_000.0, apr.income)
        assertEquals(1_200_000.0, apr.expense)
        assertEquals(1_800_000.0, apr.netIncome)

        val emptyJan = result.single { it.yearMonth == "2026-01" }
        assertEquals(0.0, emptyJan.income)
        assertEquals(0.0, emptyJan.expense)
        assertEquals(0.0, emptyJan.netIncome)

        val feb = result.single { it.yearMonth == "2026-02" }
        assertEquals(2_500_000.0, feb.income)
        assertEquals(2_900_000.0, feb.expense)
        assertEquals(-400_000.0, feb.netIncome)

        val mar = result.single { it.yearMonth == "2026-03" }
        assertEquals(0.0, mar.income)
        assertEquals(400_000.0, mar.expense)
        assertEquals(-400_000.0, mar.netIncome)
    }
}
