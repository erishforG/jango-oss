INSERT INTO admin_rules (name, description, scope, issuer, condition_json, action_json, status, activated_at, created_at, updated_at)
SELECT
    '카드 SMS 파싱 - SHINHAN',
    '신한카드 승인 SMS 파싱 (amount, merchant, approvedAt, installment)',
    'CARD_ISSUER',
    'SHINHAN',
    '{"type":"regex","pattern":"신한카드\\(\\d{4}\\)승인[\\s\\S]*?(?<amount>\\d[\\d,]*)원(?:\\((?<installment>[^)]+)\\))?(?<approvedAt>\\d{2}/\\d{2} \\d{2}:\\d{2})\\s*(?<merchant>.+?)(?:\\s|$)"}',
    '{"defaults":{"installment":"일시불"}}',
    'ACTIVE',
    now(),
    now(),
    now()
WHERE NOT EXISTS (
    SELECT 1 FROM admin_rules WHERE issuer = 'SHINHAN' AND name = '카드 SMS 파싱 - SHINHAN'
);

INSERT INTO admin_rules (name, description, scope, issuer, condition_json, action_json, status, activated_at, created_at, updated_at)
SELECT
    '카드 SMS 파싱 - LOTTE',
    '롯데카드 승인 SMS 파싱 (amount, merchant, approvedAt, installment)',
    'CARD_ISSUER',
    'LOTTE',
    '{"type":"regex","pattern":"(?<merchant>.+?)\\s+(?<amount>\\d[\\d,]*)원\\s*승인[\\s\\S]*?롯데0\\*\\d\\*\\s*(?<installment>\\S+)?\\s*(?<approvedAt>\\d{2}/\\d{2} \\d{2}:\\d{2})"}',
    '{"defaults":{"installment":"일시불"}}',
    'ACTIVE',
    now(),
    now(),
    now()
WHERE NOT EXISTS (
    SELECT 1 FROM admin_rules WHERE issuer = 'LOTTE' AND name = '카드 SMS 파싱 - LOTTE'
);

INSERT INTO admin_rules (name, description, scope, issuer, condition_json, action_json, status, activated_at, created_at, updated_at)
SELECT
    '카드 SMS 파싱 - HANA_CHECK',
    '하나 체크 승인 SMS 파싱 (amount, merchant, approvedAt, installment)',
    'CARD_ISSUER',
    'HANA_CHECK',
    '{"type":"regex","pattern":"하나0\\*\\d\\*체크승인[\\s\\S]*?(?<amount>\\d[\\d,]*)원(?<approvedAt>\\d{2}/\\d{2} \\d{2}:\\d{2})\\s*(?<merchant>.+?)(?:\\s|$)"}',
    '{"defaults":{"installment":"일시불"}}',
    'ACTIVE',
    now(),
    now(),
    now()
WHERE NOT EXISTS (
    SELECT 1 FROM admin_rules WHERE issuer = 'HANA_CHECK' AND name = '카드 SMS 파싱 - HANA_CHECK'
);
