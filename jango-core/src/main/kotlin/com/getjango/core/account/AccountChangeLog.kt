package com.getjango.core.account

import com.getjango.common.entity.BaseEntity
import com.getjango.core.ledger.Ledger
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.FetchType
import jakarta.persistence.JoinColumn
import jakarta.persistence.ManyToOne
import jakarta.persistence.Table

@Entity
@Table(name = "account_change_logs")
class AccountChangeLog(
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ledger_id", nullable = false)
    val ledger: Ledger,
    @Column(name = "action", nullable = false, length = 20)
    val action: String,
    @Column(name = "source_account_id")
    val sourceAccountId: Long? = null,
    @Column(name = "target_account_id")
    val targetAccountId: Long? = null,
    @Column(name = "new_account_id")
    val newAccountId: Long? = null,
    @Column(name = "moved_entry_count", nullable = false)
    val movedEntryCount: Int = 0,
    @Column(name = "detail", columnDefinition = "TEXT")
    val detail: String? = null,
) : BaseEntity()
