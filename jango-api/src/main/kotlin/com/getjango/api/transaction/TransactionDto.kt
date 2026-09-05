package com.getjango.api.transaction

import com.getjango.core.item.Item
import com.getjango.core.transaction.Entry
import com.getjango.core.transaction.EntryType
import com.getjango.core.transaction.Transaction

data class EntryRequest(
    val accountId: Long,
    val accountName: String? = null,
    val type: EntryType,
    val amount: Double,
    val itemName: String? = null,
)

data class TransactionRequest(
    val date: String,
    val description: String,
    val memo: String? = null,
    val entries: List<EntryRequest>,
    val tags: List<String>? = null,
    val consumerUserId: Long? = null,
    val consumerTag: String? = null,
    val draftId: Long? = null,
)

data class EntryResponse(
    val id: Long,
    val accountId: Long,
    val accountName: String,
    val accountType: String,
    val type: EntryType,
    val amount: Double,
    val itemId: Long?,
    val itemName: String?,
) {
    companion object {
        fun from(entry: Entry) =
            EntryResponse(
                id = entry.id,
                accountId = entry.account.id,
                accountName = entry.account.name,
                accountType = entry.account.type.name,
                type = entry.type,
                amount = entry.baseAmount.toDouble(),
                itemId = entry.item?.id,
                itemName = entry.item?.name,
            )
    }
}

data class ItemDto(
    val id: Long,
    val name: String,
) {
    companion object {
        fun from(item: Item) = ItemDto(id = item.id, name = item.name)
    }
}

data class TransactionResponse(
    val id: Long,
    val date: String,
    val description: String?,
    val memo: String?,
    val entries: List<EntryResponse>,
    val tags: List<String>?,
    val createdByUserId: Long,
    val lastModifiedByUserId: Long?,
    val consumerUserId: Long?,
    val consumerTag: String?,
) {
    companion object {
        fun from(
            tx: Transaction,
            entries: List<Entry>,
        ) = TransactionResponse(
            id = tx.id,
            date = tx.date.toString(),
            description = tx.description,
            memo = tx.memo,
            entries = entries.map { EntryResponse.from(it) },
            tags = tx.tags?.toList(),
            createdByUserId = tx.createdByUserId,
            lastModifiedByUserId = tx.lastModifiedByUserId,
            consumerUserId = tx.consumerUserId,
            consumerTag = tx.consumerTag,
        )
    }
}

data class PaginatedTransactionResponse(
    val content: List<TransactionResponse>,
    val totalCount: Long,
    val totalPages: Int,
    val currentPage: Int,
    val size: Int,
    val hasNext: Boolean = false,
    val nextCursorDate: String? = null,
    val nextCursorId: Long? = null,
)

data class CalendarDailySummaryResponse(
    val date: String,
    val income: Double,
    val expense: Double,
)
