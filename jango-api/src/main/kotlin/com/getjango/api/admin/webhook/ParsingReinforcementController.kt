package com.getjango.api.admin.webhook

import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.tags.Tag
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneOffset

@RestController
@RequestMapping("/api/admin/webhooks")
@Tag(
    name = "Admin Parsing Reinforcement",
    description = "파싱 실패 분석 및 규칙 강화",
)
class ParsingReinforcementController(
    private val service: ParsingReinforcementService,
    private val regexSuggestionService: RegexSuggestionService,
    private val accuracyService: ParsingAccuracyService,
) {
    @GetMapping("/parsing-accuracy")
    @Operation(summary = "파싱 정확도 분석 (rule별 유저 수정 통계)")
    fun parsingAccuracy(): ResponseEntity<ParsingAccuracyResponse> = ResponseEntity.ok(accuracyService.getAccuracy())

    @GetMapping("/parsing-analysis")
    @Operation(summary = "파싱 실패 분석 (issuer별 그룹핑)")
    fun parsingAnalysis(
        @RequestParam(required = false)
        from: String?,
        @RequestParam(required = false)
        to: String?,
        @RequestParam(required = false, defaultValue = "all")
        status: String,
        @RequestParam(required = false)
        issuer: String?,
    ): ResponseEntity<ParsingAnalysisResponse> =
        ResponseEntity.ok(
            service.getParsingAnalysis(
                from = parseFrom(from),
                to = parseTo(to),
                status = status,
                issuer = issuer,
            ),
        )

    @GetMapping("/rule-validation")
    @Operation(summary = "기존 규칙 매칭률 검증 (legacy)")
    fun ruleValidation(
        @RequestParam(required = false)
        from: String?,
        @RequestParam(required = false)
        to: String?,
        @RequestParam(required = false, defaultValue = "all")
        status: String,
        @RequestParam(required = false)
        issuer: String?,
    ): ResponseEntity<RuleValidationResponse> =
        ResponseEntity.ok(
            service.validateRules(
                from = parseFrom(from),
                to = parseTo(to),
                status = status,
                issuer = issuer,
            ),
        )

    @GetMapping("/validate-rules")
    @Operation(summary = "기존 규칙 매칭률 검증")
    fun validateRules(
        @RequestParam(required = false)
        from: String?,
        @RequestParam(required = false)
        to: String?,
        @RequestParam(required = false, defaultValue = "all")
        status: String,
        @RequestParam(required = false)
        issuer: String?,
    ): ResponseEntity<RuleValidationResponse> =
        ResponseEntity.ok(
            service.validateRules(
                from = parseFrom(from),
                to = parseTo(to),
                status = status,
                issuer = issuer,
            ),
        )

    @PostMapping("/generate-rule-from-proposals")
    @Operation(summary = "proposals 기반 새 규칙 생성")
    fun generateRule(
        @RequestBody request: GenerateRuleRequest,
    ): ResponseEntity<GenerateRuleResponse> = ResponseEntity.ok(service.generateRuleFromProposals(request.issuer))

    @PostMapping("/suggest-regex")
    @Operation(summary = "AI regex 패턴 제안")
    fun suggestRegex(
        @RequestBody request: RegexSuggestionRequest,
    ): ResponseEntity<Any> {
        val result =
            regexSuggestionService.suggestRegex(request)
                ?: return ResponseEntity
                    .badRequest()
                    .body(mapOf("error" to "AI regex 제안에 실패했습니다. API 키 설정을 확인하거나 다시 시도해주세요."))
        return ResponseEntity.ok(result)
    }

    @PostMapping("/test-regex")
    @Operation(summary = "regex 패턴 테스트")
    fun testRegex(
        @RequestBody request: TestRegexRequest,
    ): ResponseEntity<TestRegexResponse> = ResponseEntity.ok(regexSuggestionService.testRegex(request))

    @PostMapping("/approve-suggestion")
    @Operation(summary = "AI 제안 regex를 DRAFT 규칙으로 승인")
    fun approveSuggestion(
        @RequestBody request: ApproveSuggestionRequest,
    ): ResponseEntity<ApproveSuggestionResponse> = ResponseEntity.ok(regexSuggestionService.approveSuggestion(request))

    private fun parseFrom(value: String?): OffsetDateTime? {
        if (value.isNullOrBlank()) return null
        return runCatching { OffsetDateTime.parse(value) }
            .getOrElse { LocalDate.parse(value).atStartOfDay().atOffset(ZoneOffset.UTC) }
    }

    private fun parseTo(value: String?): OffsetDateTime? {
        if (value.isNullOrBlank()) return null
        return runCatching { OffsetDateTime.parse(value) }
            .getOrElse {
                LocalDate
                    .parse(value)
                    .plusDays(1)
                    .atStartOfDay()
                    .atOffset(ZoneOffset.UTC)
                    .minusNanos(1)
            }
    }
}
