package com.getjango.api.admin.rule

import com.getjango.api.error.ApiErrorCode
import com.getjango.api.error.ApiErrorException
import com.getjango.core.rule.AdminRule
import com.getjango.core.rule.AdminRuleRepository
import com.getjango.core.rule.AdminRuleScope
import com.getjango.core.rule.AdminRuleStatus
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.OffsetDateTime

@Service
class AdminRuleService(
    private val adminRuleRepository: AdminRuleRepository,
) {
    @Transactional(readOnly = true)
    fun list(
        status: AdminRuleStatus?,
        q: String?,
    ): List<AdminRuleResponse> =
        adminRuleRepository
            .search(
                status = status?.name ?: "",
                q = q?.trim()?.takeIf { it.isNotEmpty() } ?: "",
            ).map { it.toResponse() }

    @Transactional
    fun create(request: CreateAdminRuleRequest): AdminRuleResponse {
        validateName(request.name)
        validateIssuer(request.issuer)
        if (request.scope != AdminRuleScope.CARD_ISSUER) {
            throw IllegalArgumentException("Unsupported scope: ${request.scope}")
        }

        val rule =
            AdminRule(
                name = request.name.trim(),
                description = request.description?.trim()?.takeIf { it.isNotEmpty() },
                scope = request.scope,
                issuer = request.issuer.trim(),
                conditionJson = request.conditionJson.trim(),
                actionJson = request.actionJson.trim(),
                status = AdminRuleStatus.DRAFT,
            )

        return adminRuleRepository.save(rule).toResponse()
    }

    @Transactional
    fun patch(
        id: Long,
        request: PatchAdminRuleRequest,
    ): AdminRuleResponse {
        val rule = getRule(id)

        request.name?.let {
            validateName(it)
            rule.name = it.trim()
        }
        request.description?.let {
            rule.description = it.trim().takeIf { text -> text.isNotEmpty() }
        }
        request.issuer?.let {
            validateIssuer(it)
            rule.issuer = it.trim()
        }
        request.conditionJson?.let {
            rule.conditionJson = it.trim()
        }
        request.actionJson?.let {
            rule.actionJson = it.trim()
        }

        return adminRuleRepository.save(rule).toResponse()
    }

    @Transactional
    fun activate(id: Long): AdminRuleResponse {
        val rule = getRule(id)
        if (rule.status == AdminRuleStatus.DEPRECATED) {
            throw ApiErrorException(
                ApiErrorCode.RULE_NOT_ACTIVE,
                HttpStatus.CONFLICT,
                "Deprecated rule cannot be re-activated",
            )
        }
        rule.status = AdminRuleStatus.ACTIVE
        rule.activatedAt = OffsetDateTime.now()
        return adminRuleRepository.save(rule).toResponse()
    }

    @Transactional
    fun deprecate(id: Long): AdminRuleResponse {
        val rule = getRule(id)
        if (rule.status != AdminRuleStatus.ACTIVE) {
            throw ApiErrorException(
                ApiErrorCode.RULE_NOT_ACTIVE,
                HttpStatus.CONFLICT,
                "Only active rules can be deprecated",
            )
        }
        rule.status = AdminRuleStatus.DEPRECATED
        rule.deprecatedAt = OffsetDateTime.now()
        return adminRuleRepository.save(rule).toResponse()
    }

    private fun getRule(id: Long): AdminRule =
        adminRuleRepository.findById(id).orElseThrow {
            ApiErrorException(ApiErrorCode.RULE_NOT_FOUND, HttpStatus.NOT_FOUND, "Rule not found: $id")
        }

    private fun validateName(name: String) {
        if (name.trim().isEmpty()) throw IllegalArgumentException("name must not be blank")
    }

    private fun validateIssuer(issuer: String) {
        if (issuer.trim().isEmpty()) throw IllegalArgumentException("issuer must not be blank")
    }
}
