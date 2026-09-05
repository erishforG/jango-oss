package com.getjango.core.account

import org.springframework.data.jpa.repository.JpaRepository

interface AccountChangeLogRepository : JpaRepository<AccountChangeLog, Long>
