package com.getjango.api.webhook

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ObjectNode
import jakarta.servlet.http.HttpServletRequest
import org.springframework.stereotype.Component
import java.math.BigDecimal
import java.net.URLDecoder
import java.nio.charset.StandardCharsets
import java.time.LocalDate
import java.time.Year
import java.util.Locale

enum class WebhookInputMode {
    MESSAGE,
    DIRECT,
    LEGACY_JSON,
}

data class WebhookDirectInput(
    val entryDate: LocalDate,
    val item: String,
    val money: BigDecimal,
    val left: String,
    val right: String,
    val memo: String?,
)

data class ParsedWebhookRequest(
    val source: String,
    val occurredOn: LocalDate?,
    val amount: BigDecimal,
    val currency: String,
    val description: String?,
    val payload: JsonNode,
    val mode: WebhookInputMode,
    val message: String? = null,
    val direct: WebhookDirectInput? = null,
    val email: String? = null,
    val matchedRuleId: Long? = null,
)

class WebhookParseException(
    override val message: String,
) : RuntimeException(message)

@Component
class TransactionWebhookParser(
    private val objectMapper: ObjectMapper,
    private val adminRuleCardSmsParser: AdminRuleCardSmsParser,
) {
    private val directKeys = listOf("entry_date", "item", "money", "left", "right")

    fun parse(request: HttpServletRequest): ParsedWebhookRequest {
        val contentType = request.contentType?.lowercase().orEmpty()
        val rawBody = request.reader.readText().trim()

        if (contentType.contains("application/json")) {
            return parseJson(rawBody)
        }

        if (
            contentType.contains("application/x-www-form-urlencoded") ||
            contentType.contains("multipart/form-data")
        ) {
            return parseForm(request.parameterMap.mapValues { it.value.firstOrNull().orEmpty() }, rawBody)
        }

        // raw text or unknown content-type
        if (rawBody.isBlank() && request.parameterMap.isNotEmpty()) {
            return parseForm(request.parameterMap.mapValues { it.value.firstOrNull().orEmpty() }, rawBody)
        }

        return parseRaw(rawBody)
    }

    private fun parseJson(rawBody: String): ParsedWebhookRequest {
        if (rawBody.isBlank()) throw WebhookParseException("요청 본문(JSON)이 비어 있습니다.")

        val root =
            try {
                objectMapper.readTree(rawBody)
            } catch (_: Exception) {
                throw WebhookParseException("유효한 JSON 형식이 아닙니다.")
            }

        if (!root.isObject) throw WebhookParseException("JSON 최상위는 객체여야 합니다.")

        if (root.hasNonNull("message")) {
            val message = root["message"].asText().trim()
            if (message.isBlank()) throw WebhookParseException("message 값이 비어 있습니다.")
            return messageParsed(message, root)
        }

        if (hasDirectKeys(root as ObjectNode)) {
            return parseDirectMap(nodeToMap(root), root)
        }

        return parseLegacyJson(root)
    }

    private fun parseLegacyJson(root: JsonNode): ParsedWebhookRequest {
        val source =
            root
                .path("source")
                .asText("")
                .trim()
                .ifBlank { "webhook" }
        val amount = parseBigDecimal(root.path("amount").asText(null), "amount")
        val currency = root.path("currency").asText("KRW")
        val occurredOn =
            root
                .path("occurredOn")
                .asText(null)
                ?.takeIf { it.isNotBlank() }
                ?.let { parseDate(it, "occurredOn") }
        val description = root.path("description").asText(null)
        val payload = root.path("payload").takeIf { !it.isMissingNode && !it.isNull } ?: root

        return ParsedWebhookRequest(
            source = source,
            occurredOn = occurredOn,
            amount = amount,
            currency = currency,
            description = description,
            payload = payload,
            mode = WebhookInputMode.LEGACY_JSON,
            email = root.path("email").asText(null),
        )
    }

    private fun parseForm(
        fields: Map<String, String>,
        rawBody: String,
    ): ParsedWebhookRequest {
        val normalized = fields.mapKeys { it.key.lowercase() }

        normalized["message"]?.takeIf { it.isNotBlank() }?.let {
            return messageParsed(it.trim(), objectMapper.valueToTree(fields))
        }

        if (hasDirectKeys(normalized)) {
            return parseDirectMap(normalized, objectMapper.valueToTree(fields))
        }

        if (normalized.keys.any { it in setOf("source", "amount", "currency", "occurredon", "description") }) {
            val node = objectMapper.valueToTree<ObjectNode>(fields)
            return parseLegacyJson(node)
        }

        if (rawBody.isNotBlank()) {
            return parseRaw(rawBody)
        }

        throw WebhookParseException("지원하지 않는 form 데이터입니다. message 또는 direct key(entry_date,item,money,left,right,memo)를 전달하세요.")
    }

    private fun parseRaw(rawBody: String): ParsedWebhookRequest {
        if (rawBody.isBlank()) throw WebhookParseException("요청 본문이 비어 있습니다.")

        if (rawBody.startsWith("{")) {
            return parseJson(rawBody)
        }

        if (rawBody.contains("=") && (rawBody.contains("&") || rawBody.contains("entry_date="))) {
            val decoded =
                rawBody
                    .split("&")
                    .mapNotNull { pair ->
                        val parts = pair.split("=", limit = 2)
                        if (parts.isEmpty()) return@mapNotNull null
                        val key = urlDecode(parts[0]).trim()
                        if (key.isBlank()) return@mapNotNull null
                        val value = if (parts.size > 1) urlDecode(parts[1]).trim() else ""
                        key to value
                    }.toMap()
            return parseForm(decoded, "")
        }

        return messageParsed(rawBody, objectMapper.createObjectNode().put("raw", rawBody))
    }

    private fun parseDirectMap(
        fields: Map<String, String>,
        payload: JsonNode,
    ): ParsedWebhookRequest {
        val normalized = fields.mapKeys { it.key.lowercase() }
        val entryDate = parseDate(required(normalized, "entry_date"), "entry_date")
        val item = required(normalized, "item")
        val money = parseBigDecimal(required(normalized, "money"), "money")
        val left = required(normalized, "left")
        val right = required(normalized, "right")
        val memo = normalized["memo"]?.takeIf { it.isNotBlank() }

        return ParsedWebhookRequest(
            source = "webhook-direct",
            occurredOn = entryDate,
            amount = money,
            currency = "KRW",
            description = item,
            payload = payload,
            mode = WebhookInputMode.DIRECT,
            direct = WebhookDirectInput(entryDate, item, money, left, right, memo),
        )
    }

    private val smsNoisePatterns =
        listOf(
            Regex("""\[Web발신\]\s*"""),
            Regex("""\[웹발신\]\s*"""),
            Regex("""\[국제발신\]\s*"""),
            Regex("""\[국외발신\]\s*"""),
        )

    private fun stripSmsNoise(raw: String): String {
        var cleaned = raw.trim()
        for (pattern in smsNoisePatterns) {
            cleaned = pattern.replace(cleaned, "")
        }
        return cleaned.trim()
    }

    private fun messageParsed(
        message: String,
        payload: JsonNode,
    ): ParsedWebhookRequest {
        val cleanedMessage = stripSmsNoise(message)
        val parsed = adminRuleCardSmsParser.parse(cleanedMessage)
        val extractedAmount = parsed?.amount ?: (extractAmountFromMessage(cleanedMessage) ?: BigDecimal.ONE)

        val basePayload =
            when {
                payload is ObjectNode -> payload.deepCopy<ObjectNode>()
                else -> objectMapper.createObjectNode().set<ObjectNode>("rawPayload", payload)
            }

        // 카드 별칭 추출/매핑 안정화를 위해 PARSED/UNKNOWN 모두 rawMessage를 보존한다.
        basePayload.put("rawMessage", cleanedMessage)

        if (parsed == null) {
            basePayload.put("parseStatus", "UNKNOWN")
            guessIssuer(cleanedMessage, payload)?.let { basePayload.put("guessedIssuer", it) }
        } else {
            basePayload.put("parseStatus", "PARSED")
            basePayload.putObject("cardApproval").apply {
                put("ruleId", parsed.ruleId)
                put("issuer", parsed.issuer)
                put("amount", parsed.amount)
                put("merchant", parsed.merchant)
                put("approvedAt", parsed.approvedAt)
                put("installment", parsed.installment)
                parsed.maskedConsumerName?.let { put("maskedConsumerName", it) }
            }
        }

        return ParsedWebhookRequest(
            source = "webhook-message",
            occurredOn = extractOccurredOn(parsed?.approvedAt, cleanedMessage, payload),
            amount = extractedAmount,
            currency = "KRW",
            description = parsed?.merchant ?: cleanedMessage,
            payload = basePayload,
            mode = WebhookInputMode.MESSAGE,
            message = cleanedMessage,
            matchedRuleId = parsed?.ruleId,
        )
    }

    private fun extractOccurredOn(
        approvedAt: String?,
        message: String,
        payload: JsonNode,
    ): LocalDate? {
        approvedAt?.let { extractMonthDayToDate(it)?.let { date -> return date } }

        val messagePatterns =
            listOf(
                Regex("""(\d{1,2})/(\d{1,2})\s+\d{1,2}:\d{2}"""),
                Regex("""(\d{1,2})\.(\d{1,2})\s+\d{1,2}:\d{2}"""),
                Regex("""(\d{1,2})월\s*(\d{1,2})일"""),
            )
        for (pattern in messagePatterns) {
            val match = pattern.find(message)
            if (match != null) {
                val month = match.groupValues[1].toIntOrNull() ?: continue
                val day = match.groupValues[2].toIntOrNull() ?: continue
                inferDate(month, day)?.let { return it }
            }
        }

        val payloadDate =
            listOf("occurredOn", "entry_date", "date")
                .map { key -> payload.path(key).asText().trim() }
                .firstOrNull { it.isNotBlank() }

        payloadDate?.let {
            runCatching { LocalDate.parse(it) }.getOrNull()?.let { parsedDate -> return parsedDate }
        }

        return null
    }

    private fun extractMonthDayToDate(value: String): LocalDate? {
        val match = Regex("""(\d{1,2})/(\d{1,2})""").find(value) ?: return null
        val month = match.groupValues[1].toIntOrNull() ?: return null
        val day = match.groupValues[2].toIntOrNull() ?: return null
        return inferDate(month, day)
    }

    private fun inferDate(
        month: Int,
        day: Int,
    ): LocalDate? {
        val now = LocalDate.now()
        val currentYear = Year.now().value
        val thisYearDate = runCatching { LocalDate.of(currentYear, month, day) }.getOrNull() ?: return null
        return if (thisYearDate.isAfter(now.plusDays(1))) thisYearDate.minusYears(1) else thisYearDate
    }

    private fun parseDate(
        value: String,
        field: String,
    ): LocalDate =
        try {
            LocalDate.parse(value)
        } catch (_: Exception) {
            throw WebhookParseException("$field 는 yyyy-MM-dd 형식이어야 합니다.")
        }

    private fun extractAmountFromMessage(message: String): BigDecimal? {
        val match = Regex("""(\d[\d,]*)\s*원?""").find(message) ?: return null
        val normalized = match.groupValues[1].replace(",", "")
        return normalized.toBigDecimalOrNull()
    }

    private fun parseBigDecimal(
        value: String?,
        field: String,
    ): BigDecimal {
        val normalized = value?.replace(",", "")?.trim().orEmpty()
        if (normalized.isBlank()) throw WebhookParseException("$field 값이 필요합니다.")
        return try {
            BigDecimal(normalized)
        } catch (_: Exception) {
            throw WebhookParseException("$field 는 숫자여야 합니다.")
        }
    }

    private fun required(
        map: Map<String, String>,
        key: String,
    ): String = map[key]?.trim()?.takeIf { it.isNotBlank() } ?: throw WebhookParseException("$key 값이 필요합니다.")

    private fun hasDirectKeys(node: ObjectNode): Boolean = directKeys.all { node.has(it) }

    private fun hasDirectKeys(map: Map<String, String>): Boolean = directKeys.all { map.containsKey(it) }

    private fun nodeToMap(node: ObjectNode): Map<String, String> {
        val fields = mutableMapOf<String, String>()
        node.fields().forEachRemaining { (k, v) -> fields[k] = v.asText("") }
        return fields
    }

    private fun guessIssuer(
        message: String,
        payload: JsonNode,
    ): String? {
        val hint =
            buildString {
                append(message)
                append(' ')
                append(payload.toString())
            }.lowercase(Locale.getDefault())

        return when {
            hint.contains("신한") -> "SHINHAN"
            hint.contains("롯데") -> "LOTTE"
            hint.contains("하나") && hint.contains("체크") -> "HANA_CHECK"
            hint.contains("kb") || hint.contains("국민") -> "KB"
            hint.contains("삼성") -> "SAMSUNG"
            hint.contains("현대") -> "HYUNDAI"
            hint.contains("우리") -> "WOORI"
            hint.contains("nh") || hint.contains("농협") -> "NH"
            hint.contains("bc") -> "BC"
            else -> null
        }
    }

    private fun urlDecode(value: String): String = URLDecoder.decode(value, StandardCharsets.UTF_8)
}
