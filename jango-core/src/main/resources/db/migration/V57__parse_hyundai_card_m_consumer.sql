UPDATE admin_rules
SET description = '현대카드M 승인 SMS 파싱 (consumer, amount, installment, approvedAt, merchant)',
    condition_json = '{"type":"regex","pattern":"현대(?:카드)?M?\\s*승인\\s*(?:(?<maskedConsumerName>[가-힣]\\*[가-힣])\\s*)?[\\s\\S]*?(?<amount>\\d[\\d,]*)원(?:\\s*\\(?(?<installment>일시불|\\d+개월)\\)?)?[\\s\\S]*?(?<approvedAt>\\d{2}/\\d{2}\\s+\\d{2}:\\d{2})\\s*(?<merchant>[^\\r\\n]+?)(?=\\s*(?:\\r?\\n|누적[\\d,]+원|$))"}',
    action_json = '{"defaults":{"installment":"일시불"}}',
    updated_at = now()
WHERE issuer = 'HYUNDAI'
  AND name = '카드 SMS 파싱 - HYUNDAI';
