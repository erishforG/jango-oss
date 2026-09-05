package com.getjango.common.exception

/**
 * 비즈니스 로직 예외의 기반 클래스.
 */
open class BusinessException(
    val errorCode: String,
    override val message: String,
    override val cause: Throwable? = null,
) : RuntimeException(message, cause)

class EntityNotFoundException(
    entityName: String,
    id: Any,
) : BusinessException(
        errorCode = "NOT_FOUND",
        message = "$entityName not found: $id",
    )

class BalanceMismatchException(
    debitSum: Any,
    creditSum: Any,
) : BusinessException(
        errorCode = "BALANCE_MISMATCH",
        message = "Entry balance mismatch: DR($debitSum) != CR($creditSum)",
    )
