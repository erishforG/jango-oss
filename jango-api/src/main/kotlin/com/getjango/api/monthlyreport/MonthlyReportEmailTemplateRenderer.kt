package com.getjango.api.monthlyreport

import org.springframework.stereotype.Component
import java.math.BigDecimal
import java.math.RoundingMode
import java.text.DecimalFormat
import kotlin.math.abs

@Component
class MonthlyReportEmailTemplateRenderer {
    private val currencyFormatter = DecimalFormat("#,###")
    private val financeTips =
        listOf(
            "고정비 점검은 3개월에 한 번만 해도 지출 체질이 크게 좋아져요.",
            "월급날 바로 저축 계좌로 자동이체를 걸면 저축 성공률이 높아져요.",
            "지출이 늘어난 카테고리 1개만 잡아도 다음 달 체감이 달라져요.",
            "예산은 빡빡하게보다 현실적으로 잡을수록 오래 유지돼요.",
            "소액 구독 서비스 정리만으로도 월 고정지출을 줄일 수 있어요.",
        )

    fun renderFreeKo(payload: MonthlyAggregationResult): MonthlyReportEmailContent {
        val savingTone = if (payload.savingAmount >= BigDecimal.ZERO) "흑자" else "적자"
        val subject = "[jango] ${payload.periodYm} 월간 리포트"
        val tip = pickTip(payload.periodYm)
        val summaryCards = renderSummaryCards(payload)
        val categoryChanges = renderTopCategoryChanges(payload.topCategoryChanges)
        val anomalySection = renderAnomalies(payload.anomalyCandidates)

        val body =
            """
            <html lang="ko">
            <head>
              <meta charset="UTF-8" />
              <meta name="viewport" content="width=device-width, initial-scale=1.0" />
              <style>
                body { margin: 0; padding: 0; background-color: #F5F7FF; }
                @media (max-width: 640px) {
                  .container { width: 100% !important; border-radius: 0 !important; }
                  .section { padding: 18px !important; }
                  .metric { display: block !important; width: 100% !important; }
                }
              </style>
            </head>
            <body style="margin: 0; padding: 24px 12px; background-color: #F5F7FF; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans KR', sans-serif; color: #111827;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td align="center">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="620" class="container" style="width: 620px; max-width: 100%; background-color: #FFFFFF; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 20px rgba(99, 102, 241, 0.08);">
                      <tr>
                        <td style="padding: 24px 24px 20px; background: linear-gradient(135deg, #6366F1, #4F46E5); color: #FFFFFF;">
                          <div style="font-size: 13px; opacity: 0.9; margin-bottom: 8px;">jango 월간 리포트 (무료)</div>
                          <h1 style="margin: 0; font-size: 24px; line-height: 1.4;">${payload.periodYm} 소비 리포트</h1>
                          <p style="margin: 10px 0 0; font-size: 15px; line-height: 1.6;">
                            이번 달은 <strong>$savingTone</strong>로 마감했어요.
                            지금 흐름을 보면 다음 달 자산 계획도 더 똑똑하게 세울 수 있어요.
                          </p>
                        </td>
                      </tr>

                      <tr>
                        <td class="section" style="padding: 22px 24px 8px;">
                          <h2 style="margin: 0 0 12px; font-size: 18px; color: #111827;">📊 이달의 요약</h2>
                          $summaryCards
                        </td>
                      </tr>

                      <tr>
                        <td class="section" style="padding: 16px 24px 8px;">
                          <h2 style="margin: 0 0 12px; font-size: 18px; color: #111827;">📈 카테고리 변화 TOP 3</h2>
                          $categoryChanges
                        </td>
                      </tr>

                      <tr>
                        <td class="section" style="padding: 16px 24px 8px;">
                          <h2 style="margin: 0 0 12px; font-size: 18px; color: #111827;">⚠️ 이상 거래 감지</h2>
                          $anomalySection
                        </td>
                      </tr>

                      <tr>
                        <td class="section" style="padding: 16px 24px 8px;">
                          <h2 style="margin: 0 0 8px; font-size: 18px; color: #111827;">💡 한 줄 팁</h2>
                          <div style="padding: 14px 16px; border-radius: 12px; border: 1px solid #E5E7EB; background: #FAFAFF; color: #374151; line-height: 1.6;">
                            $tip
                          </div>
                        </td>
                      </tr>

                      <tr>
                        <td class="section" style="padding: 16px 24px 10px;">
                          <h2 style="margin: 0 0 8px; font-size: 18px; color: #111827;">🔒 Pro 티저</h2>
                          <div style="padding: 14px 16px; border-radius: 12px; background-color: #EEF2FF; color: #312E81; line-height: 1.7;">
                            Pro에서는 <strong>AI 맞춤 분석</strong>, <strong>예산 추적</strong>,
                            <strong>자산 트렌드</strong>를 한 번에 확인할 수 있어요.
                          </div>
                        </td>
                      </tr>

                      <tr>
                        <td style="padding: 12px 24px 28px;">
                          <a href="https://jango.monster"
                             style="display: inline-block; padding: 12px 18px; border-radius: 10px; background-color: #6366F1; color: #FFFFFF; font-weight: 600; text-decoration: none;">
                            잔고에서 자세히 보기
                          </a>
                          <p style="margin: 14px 0 0; color: #6B7280; font-size: 12px; line-height: 1.5;">
                            이 메일은 무료 리포트 기준으로 제공됩니다. 더 깊은 분석은 Pro에서 확인해보세요.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </body>
            </html>
            """.trimIndent()

        return MonthlyReportEmailContent(subject = subject, htmlBody = body)
    }

    private fun renderSummaryCards(payload: MonthlyAggregationResult): String {
        val rateText = formatPercent(payload.savingRate)
        return """
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse: separate; border-spacing: 8px;">
              <tr>
                <td class="metric" width="33%" style="padding: 14px; border: 1px solid #E5E7EB; border-radius: 12px; background: #FFFFFF;">
                  <div style="color: #6B7280; font-size: 12px; margin-bottom: 6px;">수입</div>
                  <div style="font-size: 18px; font-weight: 700; color: #111827;">${formatWon(payload.income)}</div>
                </td>
                <td class="metric" width="33%" style="padding: 14px; border: 1px solid #E5E7EB; border-radius: 12px; background: #FFFFFF;">
                  <div style="color: #6B7280; font-size: 12px; margin-bottom: 6px;">지출</div>
                  <div style="font-size: 18px; font-weight: 700; color: #111827;">${formatWon(payload.expense)}</div>
                </td>
                <td class="metric" width="33%" style="padding: 14px; border: 1px solid #E5E7EB; border-radius: 12px; background: #FFFFFF;">
                  <div style="color: #6B7280; font-size: 12px; margin-bottom: 6px;">저축률</div>
                  <div style="font-size: 18px; font-weight: 700; color: #4F46E5;">$rateText</div>
                </td>
              </tr>
            </table>
            <div style="margin-top: 10px; color: #374151; font-size: 14px;">
              저축 금액: <strong>${formatWon(payload.savingAmount)}</strong>
            </div>
            """.trimIndent()
    }

    private fun renderTopCategoryChanges(changes: List<CategoryChange>): String {
        if (changes.isEmpty()) {
            return "<p style=\"margin: 0; color: #6B7280;\">전월 대비 큰 변화가 발견되지 않았어요.</p>"
        }

        val items =
            changes.take(3).joinToString(separator = "") { change ->
                val directionEmoji = if (change.deltaAmount >= BigDecimal.ZERO) "🔺" else "🔻"
                val directionText = if (change.deltaAmount >= BigDecimal.ZERO) "증가" else "감소"
                val percentText =
                    if (change.previousAmount.compareTo(BigDecimal.ZERO) == 0) {
                        "신규 변동"
                    } else {
                        val ratio =
                            change.deltaAmount
                                .abs()
                                .multiply(BigDecimal(100))
                                .divide(change.previousAmount.abs(), 1, RoundingMode.HALF_UP)
                        "지난달 대비 ${ratio.stripTrailingZeros().toPlainString()}% $directionText"
                    }

                """
                <div style="padding: 12px 14px; border-radius: 10px; border: 1px solid #E5E7EB; margin-bottom: 8px; background: #FFFFFF;">
                  <div style="font-size: 14px; color: #111827; line-height: 1.6;">
                    $directionEmoji <strong>${escapeHtml(change.accountName)}</strong>이(가) $percentText
                  </div>
                  <div style="margin-top: 4px; color: #6B7280; font-size: 12px;">
                    ${formatWon(change.previousAmount)} → ${formatWon(change.currentAmount)} (${formatSignedWon(change.deltaAmount)})
                  </div>
                </div>
                """.trimIndent()
            }

        return items
    }

    private fun renderAnomalies(anomalies: List<AnomalyCandidate>): String {
        if (anomalies.isEmpty()) {
            return "<p style=\"margin: 0; color: #6B7280;\">감지된 이상 거래가 없어요. 좋은 소비 흐름을 유지하고 있어요.</p>"
        }

        return anomalies.take(3).joinToString(separator = "") { anomaly ->
            val baselineText = anomaly.baselineAverage?.let { "평균 ${formatWon(it)}" } ?: "평균 데이터 없음"
            """
            <div style="padding: 12px 14px; border-radius: 10px; border: 1px solid #FECACA; margin-bottom: 8px; background: #FEF2F2;">
              <div style="font-size: 14px; color: #7F1D1D; line-height: 1.6;">
                <strong>${escapeHtml(anomaly.accountName)}</strong> · ${escapeHtml(anomaly.description)}
              </div>
              <div style="margin-top: 4px; color: #991B1B; font-size: 12px;">
                ${formatWon(anomaly.amount)} (기준: $baselineText)
              </div>
            </div>
            """.trimIndent()
        }
    }

    private fun pickTip(periodYm: String): String {
        val index = abs(periodYm.hashCode()) % financeTips.size
        return financeTips[index]
    }

    private fun formatWon(amount: BigDecimal): String {
        val rounded = amount.setScale(0, RoundingMode.HALF_UP)
        return "${currencyFormatter.format(rounded)}원"
    }

    private fun formatSignedWon(amount: BigDecimal): String {
        val sign = if (amount >= BigDecimal.ZERO) "+" else "-"
        return "$sign${formatWon(amount.abs())}"
    }

    private fun formatPercent(rate: BigDecimal?): String {
        if (rate == null) {
            return "-"
        }
        return "${rate.stripTrailingZeros().toPlainString()}%"
    }

    private fun escapeHtml(value: String): String =
        value
            .replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace("\"", "&quot;")
            .replace("'", "&#39;")
}

data class MonthlyReportEmailContent(
    val subject: String,
    val htmlBody: String,
)
