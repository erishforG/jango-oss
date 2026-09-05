package com.getjango.core.transaction

import com.getjango.common.entity.BaseEntity
import com.getjango.core.ledger.Ledger
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.FetchType
import jakarta.persistence.JoinColumn
import jakarta.persistence.ManyToOne
import jakarta.persistence.Table
import java.time.LocalDate

@Entity
@Table(name = "transactions")
class Transaction(
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ledger_id", nullable = false)
    val ledger: Ledger,
    @Column(nullable = false)
    var date: LocalDate,
    var description: String? = null,
    var memo: String? = null,
    @Column(columnDefinition = "varchar[]")
    var tags: Array<String>? = null,
    var source: String? = null,
    @Column(name = "created_by_user_id", nullable = false)
    var createdByUserId: Long = ledger.user.id,
    @Column(name = "last_modified_by_user_id")
    var lastModifiedByUserId: Long? = null,
    @Column(name = "consumer_user_id")
    var consumerUserId: Long? = null,
    @Column(name = "consumer_tag")
    var consumerTag: String? = null,
    @Column(name = "draft_id")
    var draftId: Long? = null,
) : BaseEntity()
