package com.getjango.core.transactiondraft

enum class TransactionDraftStatus {
    RECEIVED,
    REPROCESSING,
    APPLIED,
    DISCARDED,
}
