package com.getjango.api.importcsv

import java.util.concurrent.ConcurrentHashMap

data class ImportStatus(
    val importId: String,
    var total: Int = 0,
    var imported: Int = 0,
    var skipped: Int = 0,
    var accountsCreated: Int = 0,
    var skippedUnknownType: Int = 0,
    var skippedOneSidedEntry: Int = 0,
    var skippedInvalidDate: Int = 0,
    var skippedInvalidAmount: Int = 0,
    var skippedInvalidShape: Int = 0,
    var closedAccounts: Int = 0,
    var openingRowsDetected: Int = 0,
    var openingNameNormalized: Int = 0,
    var negativeAmountSwapped: Int = 0,
    var done: Boolean = false,
    var error: String? = null,
    var sampleErrors: MutableList<String> = mutableListOf(),
)

object ImportStatusStore {
    private val store = ConcurrentHashMap<String, ImportStatus>()

    fun create(importId: String): ImportStatus {
        val status = ImportStatus(importId = importId)
        store[importId] = status
        return status
    }

    fun get(importId: String): ImportStatus? = store[importId]

    fun remove(importId: String) {
        store.remove(importId)
    }
}
