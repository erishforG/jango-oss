package com.getjango.api.monthlyreport

import com.fasterxml.jackson.databind.ObjectMapper
import com.getjango.core.job.JobRequestIdempotency
import com.getjango.core.job.JobRequestIdempotencyRepository
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.security.MessageDigest

@Service
class JobIdempotencyService(
    private val repository: JobRequestIdempotencyRepository,
    private val objectMapper: ObjectMapper,
) {
    @Transactional
    fun <T : Any> execute(
        action: String,
        idempotencyKey: String?,
        payload: Any,
        responseType: Class<T>,
        block: () -> T,
    ): Pair<T, Boolean> {
        if (idempotencyKey.isNullOrBlank()) return block() to false

        val requestHash = sha256(objectMapper.writeValueAsString(payload))
        val existing = repository.findByActionAndIdempotencyKey(action, idempotencyKey)
        if (existing != null) {
            if (existing.requestHash != requestHash) {
                throw IllegalArgumentException("Idempotency key already used with different payload")
            }
            val body = existing.responseBody ?: throw IllegalStateException("Idempotency response body is missing")
            return objectMapper.readValue(body, responseType) to true
        }

        val response = block()
        val saved =
            JobRequestIdempotency(
                action = action,
                idempotencyKey = idempotencyKey,
                requestHash = requestHash,
                responseBody = objectMapper.writeValueAsString(response),
            )

        try {
            repository.save(saved)
        } catch (_: DataIntegrityViolationException) {
            val duplicated =
                repository.findByActionAndIdempotencyKey(action, idempotencyKey)
                    ?: throw IllegalStateException("Unable to load duplicated idempotency key")
            val body = duplicated.responseBody ?: throw IllegalStateException("Idempotency response body is missing")
            return objectMapper.readValue(body, responseType) to true
        }

        return response to false
    }

    private fun sha256(value: String): String {
        val md = MessageDigest.getInstance("SHA-256")
        return md.digest(value.toByteArray()).joinToString("") { "%02x".format(it) }
    }
}
