package com.getjango.core.importjob

import com.getjango.common.entity.BaseEntity
import com.getjango.core.ledger.Ledger
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.FetchType
import jakarta.persistence.JoinColumn
import jakarta.persistence.ManyToOne
import jakarta.persistence.Table

@Entity
@Table(name = "import_jobs")
class ImportJob(
    @Column(name = "import_id", nullable = false, unique = true, length = 64)
    var importId: String,
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ledger_id", nullable = false)
    val ledger: Ledger,
    @Column(nullable = false)
    var total: Int = 0,
    @Column(nullable = false)
    var imported: Int = 0,
    @Column(nullable = false)
    var skipped: Int = 0,
    @Column(name = "accounts_created", nullable = false)
    var accountsCreated: Int = 0,
    @Column(name = "skipped_unknown_type", nullable = false)
    var skippedUnknownType: Int = 0,
    @Column(name = "skipped_one_sided_entry", nullable = false)
    var skippedOneSidedEntry: Int = 0,
    @Column(name = "skipped_invalid_date", nullable = false)
    var skippedInvalidDate: Int = 0,
    @Column(name = "skipped_invalid_amount", nullable = false)
    var skippedInvalidAmount: Int = 0,
    @Column(name = "skipped_invalid_shape", nullable = false)
    var skippedInvalidShape: Int = 0,
    @Column(name = "closed_accounts", nullable = false)
    var closedAccounts: Int = 0,
    @Column(nullable = false)
    var done: Boolean = false,
    @Column(columnDefinition = "text")
    var error: String? = null,
    @Column(name = "sample_errors", columnDefinition = "text")
    var sampleErrors: String? = null,
) : BaseEntity()
