package com.getjango.api.account

import com.getjango.core.account.Account
import com.getjango.core.account.AccountRepository
import com.getjango.core.account.AccountType
import com.getjango.core.ledger.Ledger
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

/** 온보딩 시 계정과목 템플릿 유형 */
enum class AccountTemplate {
    DEFAULT, // 기본 (기존 동작)
    SALARY, // 직장인
    FAMILY, // 부부/가족
    SOLO, // 1인가구
}

@Service
class DefaultAccountSeeder(
    private val accountRepository: AccountRepository,
) {
    companion object {
        // 기본 템플릿 (locale별)
        private val DEFAULT_ACCOUNTS_BY_LOCALE =
            mapOf(
                "ko" to
                    mapOf(
                        AccountType.ASSET to listOf("현금", "은행", "저축", "투자"),
                        AccountType.LIABILITY to listOf("신용카드", "대출"),
                        AccountType.INCOME to listOf("급여", "부수입"),
                        AccountType.EXPENSE to listOf("식비", "교통비", "주거비", "생활비", "통신비", "의료비", "여가", "기타"),
                        AccountType.EQUITY to listOf("기초자산"),
                    ),
                "en" to
                    mapOf(
                        AccountType.ASSET to listOf("Cash", "Bank", "Savings", "Investment"),
                        AccountType.LIABILITY to listOf("Credit Card", "Loan"),
                        AccountType.INCOME to listOf("Salary", "Side Income"),
                        AccountType.EXPENSE to listOf("Food", "Transport", "Housing", "Telecom", "Medical", "Leisure", "Others"),
                        AccountType.EQUITY to listOf("Opening Balance"),
                    ),
                "ja" to
                    mapOf(
                        AccountType.ASSET to listOf("現金", "銀行", "貯金", "投資"),
                        AccountType.LIABILITY to listOf("クレジットカード", "ローン"),
                        AccountType.INCOME to listOf("給与", "副収入"),
                        AccountType.EXPENSE to listOf("食費", "交通費", "住居費", "通信費", "医療費", "娯楽", "その他"),
                        AccountType.EQUITY to listOf("期首資本"),
                    ),
            )

        // 직장인 템플릿
        private val SALARY_ACCOUNTS_BY_LOCALE =
            mapOf(
                "ko" to
                    mapOf(
                        AccountType.ASSET to listOf("현금", "입출금통장", "저축통장", "투자"),
                        AccountType.LIABILITY to listOf("신용카드", "체크카드", "대출"),
                        AccountType.INCOME to listOf("급여", "상여금", "부수입"),
                        AccountType.EXPENSE to listOf("식비", "외식", "교통비", "주거비", "통신비", "의료비", "의류", "자기계발", "여가", "기타"),
                        AccountType.EQUITY to listOf("기초자산"),
                    ),
                "en" to
                    mapOf(
                        AccountType.ASSET to listOf("Cash", "Checking", "Savings", "Investment"),
                        AccountType.LIABILITY to listOf("Credit Card", "Debit Card", "Loan"),
                        AccountType.INCOME to listOf("Salary", "Bonus", "Side Income"),
                        AccountType.EXPENSE to
                            listOf(
                                "Groceries",
                                "Dining Out",
                                "Transport",
                                "Housing",
                                "Telecom",
                                "Medical",
                                "Clothing",
                                "Self-dev",
                                "Leisure",
                                "Others",
                            ),
                        AccountType.EQUITY to listOf("Opening Balance"),
                    ),
                "ja" to
                    mapOf(
                        AccountType.ASSET to listOf("現金", "普通預金", "貯金", "投資"),
                        AccountType.LIABILITY to listOf("クレジットカード", "デビットカード", "ローン"),
                        AccountType.INCOME to listOf("給与", "賞与", "副収入"),
                        AccountType.EXPENSE to listOf("食費", "外食", "交通費", "住居費", "通信費", "医療費", "衣料費", "自己啓発", "娯楽", "その他"),
                        AccountType.EQUITY to listOf("期首資本"),
                    ),
            )

        // 부부/가족 템플릿
        private val FAMILY_ACCOUNTS_BY_LOCALE =
            mapOf(
                "ko" to
                    mapOf(
                        AccountType.ASSET to listOf("현금", "공동통장", "저축", "투자"),
                        AccountType.LIABILITY to listOf("공동카드", "주택담보대출", "기타대출"),
                        AccountType.INCOME to listOf("급여(본인)", "급여(배우자)", "부수입"),
                        AccountType.EXPENSE to listOf("식비", "주거비", "육아비", "교육비", "의료비", "교통비", "통신비", "여가", "기타"),
                        AccountType.EQUITY to listOf("기초자산"),
                    ),
                "en" to
                    mapOf(
                        AccountType.ASSET to listOf("Cash", "Joint Account", "Savings", "Investment"),
                        AccountType.LIABILITY to listOf("Joint Card", "Mortgage", "Other Loan"),
                        AccountType.INCOME to listOf("Salary (Self)", "Salary (Partner)", "Side Income"),
                        AccountType.EXPENSE to
                            listOf(
                                "Food",
                                "Housing",
                                "Childcare",
                                "Education",
                                "Medical",
                                "Transport",
                                "Telecom",
                                "Leisure",
                                "Others",
                            ),
                        AccountType.EQUITY to listOf("Opening Balance"),
                    ),
                "ja" to
                    mapOf(
                        AccountType.ASSET to listOf("現金", "共同口座", "貯金", "投資"),
                        AccountType.LIABILITY to listOf("共同カード", "住宅ローン", "その他ローン"),
                        AccountType.INCOME to listOf("給与(自分)", "給与(配偶者)", "副収入"),
                        AccountType.EXPENSE to listOf("食費", "住居費", "育児費", "教育費", "医療費", "交通費", "通信費", "娯楽", "その他"),
                        AccountType.EQUITY to listOf("期首資本"),
                    ),
            )

        // 1인가구 템플릿
        private val SOLO_ACCOUNTS_BY_LOCALE =
            mapOf(
                "ko" to
                    mapOf(
                        AccountType.ASSET to listOf("현금", "은행", "저축"),
                        AccountType.LIABILITY to listOf("신용카드"),
                        AccountType.INCOME to listOf("급여/수입"),
                        AccountType.EXPENSE to listOf("식비", "월세/관리비", "교통비", "통신비", "의료비", "여가", "기타"),
                        AccountType.EQUITY to listOf("기초자산"),
                    ),
                "en" to
                    mapOf(
                        AccountType.ASSET to listOf("Cash", "Bank", "Savings"),
                        AccountType.LIABILITY to listOf("Credit Card"),
                        AccountType.INCOME to listOf("Income"),
                        AccountType.EXPENSE to listOf("Food", "Rent", "Transport", "Telecom", "Medical", "Leisure", "Others"),
                        AccountType.EQUITY to listOf("Opening Balance"),
                    ),
                "ja" to
                    mapOf(
                        AccountType.ASSET to listOf("現金", "銀行", "貯金"),
                        AccountType.LIABILITY to listOf("クレジットカード"),
                        AccountType.INCOME to listOf("収入"),
                        AccountType.EXPENSE to listOf("食費", "家賃", "交通費", "通信費", "医療費", "娯楽", "その他"),
                        AccountType.EQUITY to listOf("期首資本"),
                    ),
            )

        private val ACCOUNTS_BY_TEMPLATE =
            mapOf(
                AccountTemplate.DEFAULT to DEFAULT_ACCOUNTS_BY_LOCALE,
                AccountTemplate.SALARY to SALARY_ACCOUNTS_BY_LOCALE,
                AccountTemplate.FAMILY to FAMILY_ACCOUNTS_BY_LOCALE,
                AccountTemplate.SOLO to SOLO_ACCOUNTS_BY_LOCALE,
            )
    }

    /**
     * 계정과목 템플릿을 기반으로 기본 계정과목을 생성합니다.
     * 이미 계정이 존재하는 경우(CSV 임포트 등) 스킵합니다.
     */
    @Transactional
    fun seedDefaultAccounts(
        ledger: Ledger,
        locale: String,
        template: AccountTemplate = AccountTemplate.DEFAULT,
    ): List<Account> {
        if (accountRepository.findByLedgerIdOrderByDisplayOrder(ledger.id).isNotEmpty()) {
            return emptyList()
        }

        val normalizedLocale = if (locale in listOf("ko", "en", "ja")) locale else "ko"
        val accountsByLocale = ACCOUNTS_BY_TEMPLATE[template] ?: DEFAULT_ACCOUNTS_BY_LOCALE
        val accountDefs = accountsByLocale[normalizedLocale] ?: DEFAULT_ACCOUNTS_BY_LOCALE.getValue("ko")

        val accounts = mutableListOf<Account>()
        var displayOrder = 0

        for ((type, names) in accountDefs) {
            for (name in names) {
                accounts.add(
                    accountRepository.save(
                        Account(
                            ledger = ledger,
                            name = name,
                            type = type,
                            displayOrder = displayOrder++,
                        ),
                    ),
                )
            }
        }

        return accounts
    }
}
