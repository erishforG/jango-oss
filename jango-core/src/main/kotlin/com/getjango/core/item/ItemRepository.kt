package com.getjango.core.item

import org.springframework.data.jpa.repository.JpaRepository

interface ItemRepository : JpaRepository<Item, Long> {
    fun findByAccountId(accountId: Long): List<Item>

    fun findByAccountIdAndName(
        accountId: Long,
        name: String,
    ): Item?
}
