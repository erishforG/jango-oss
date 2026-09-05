package com.getjango.api.account

import com.getjango.core.account.Account
import com.getjango.core.account.AccountType
import java.time.LocalDate

data class AccountRequest(
    val name: String,
    val type: AccountType,
    val parentId: Long? = null,
    val isActive: Boolean = true,
    val displayOrder: Int = 0,
    val startDate: LocalDate? = null,
    val endDate: LocalDate? = null,
    val isGroup: Boolean = false,
    val subtype: String? = null,
    val settlementDay: Int? = null,
    val billingStartDay: Int? = null,
    val billingDurationMonths: Int? = null,
    val issuerTag: String? = null,
    val memo: String? = null,
    val linkedAccountId: Long? = null,
    val iconEmoji: String? = null,
)

data class AccountResponse(
    val id: Long,
    val parentId: Long?,
    val name: String,
    val type: AccountType,
    val balance: Double,
    val isActive: Boolean,
    val displayOrder: Int,
    val startDate: LocalDate?,
    val endDate: LocalDate?,
    val isGroup: Boolean,
    val subtype: String? = null,
    val settlementDay: Int? = null,
    val billingStartDay: Int? = null,
    val billingDurationMonths: Int? = null,
    val issuerTag: String? = null,
    val memo: String? = null,
    val linkedAccountId: Long? = null,
    val iconEmoji: String? = null,
    val hasEntries: Boolean = false,
    val children: List<AccountResponse> = emptyList(),
) {
    companion object {
        fun from(
            account: Account,
            balance: Double = 0.0,
            children: List<AccountResponse> = emptyList(),
            hasEntries: Boolean = false,
        ) = AccountResponse(
            id = account.id,
            parentId = account.parent?.id,
            name = account.name,
            type = account.type,
            balance = balance,
            isActive = account.isActive,
            displayOrder = account.displayOrder,
            startDate = account.startDate,
            endDate = account.endDate,
            isGroup = account.isGroup,
            subtype = account.subtype,
            settlementDay = account.settlementDay,
            billingStartDay = account.billingStartDay,
            billingDurationMonths = account.billingDurationMonths,
            issuerTag = account.issuerTag,
            memo = account.memo,
            linkedAccountId = account.linkedAccountId,
            iconEmoji = account.iconEmoji,
            hasEntries = hasEntries,
            children = children,
        )
    }
}

data class ReorderRequest(
    val orders: List<AccountOrder>,
)

data class AccountOrder(
    val id: Long,
    val parentId: Long? = null,
    val displayOrder: Int,
)

data class MergeAccountRequest(
    val sourceAccountId: Long,
    val targetAccountId: Long,
    val deleteSource: Boolean = false,
)

data class SplitAccountRequest(
    val sourceAccountId: Long,
    val newAccountName: String,
    val startDate: LocalDate? = null,
    val endDate: LocalDate? = null,
    val keyword: String? = null,
    val minAmount: Double? = null,
    val maxAmount: Double? = null,
    val transactionIds: List<Long> = emptyList(),
)

data class AccountChangeResponse(
    val sourceAccountId: Long,
    val targetAccountId: Long,
    val movedEntryCount: Int,
)
