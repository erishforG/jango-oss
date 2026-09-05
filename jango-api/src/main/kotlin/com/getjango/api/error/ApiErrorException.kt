package com.getjango.api.error

import org.springframework.http.HttpStatus

open class ApiErrorException(
    val code: ApiErrorCode,
    val status: HttpStatus,
    message: String,
) : RuntimeException(message)
