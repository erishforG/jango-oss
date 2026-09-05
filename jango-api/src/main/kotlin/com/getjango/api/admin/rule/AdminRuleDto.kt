package com.getjango.api.admin.rule

import com.getjango.core.rule.AdminRule
import com.getjango.core.rule.AdminRuleScope
import com.getjango.core.rule.AdminRuleStatus
import io.swagger.v3.oas.annotations.media.Schema

@Schema(description = "Admin rule resource")
data class AdminRuleResponse(
    val id: Long,
    val name: String,
    val description: String?,
    val scope: AdminRuleScope,
    val issuer: String,
    val conditionJson: String,
    val actionJson: String,
    val status: AdminRuleStatus,
    val activatedAt: String?,
    val deprecatedAt: String?,
    val createdAt: String,
    val updatedAt: String,
)

@Schema(description = "Create admin rule request")
data class CreateAdminRuleRequest(
    val name: String,
    val description: String? = null,
    val scope: AdminRuleScope = AdminRuleScope.CARD_ISSUER,
    val issuer: String,
    val conditionJson: String,
    val actionJson: String,
)

@Schema(description = "Patch admin rule request")
data class PatchAdminRuleRequest(
    val name: String? = null,
    val description: String? = null,
    val issuer: String? = null,
    val conditionJson: String? = null,
    val actionJson: String? = null,
)

fun AdminRule.toResponse(): AdminRuleResponse =
    AdminRuleResponse(
        id = id,
        name = name,
        description = description,
        scope = scope,
        issuer = issuer,
        conditionJson = conditionJson,
        actionJson = actionJson,
        status = status,
        activatedAt = activatedAt?.toString(),
        deprecatedAt = deprecatedAt?.toString(),
        createdAt = createdAt.toString(),
        updatedAt = updatedAt.toString(),
    )
