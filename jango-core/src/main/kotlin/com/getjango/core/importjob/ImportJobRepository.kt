package com.getjango.core.importjob

import org.springframework.data.jpa.repository.JpaRepository

interface ImportJobRepository : JpaRepository<ImportJob, Long> {
    fun findByImportId(importId: String): ImportJob?
}
