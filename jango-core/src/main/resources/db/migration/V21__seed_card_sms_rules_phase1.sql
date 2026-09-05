INSERT INTO admin_rules (name, description, scope, issuer, condition_json, action_json, status, activated_at, created_at, updated_at)
SELECT
    '카드 SMS 파싱 - KB',
    'KB카드 승인 SMS 파싱 (amount, merchant, approvedAt, installment)',
    'CARD_ISSUER',
    'KB',
    '{"type":"regex","pattern":"KB(?:국민)?카드[\\s\\S]*?(?<amount>\\d[\\d,]*)원\\s*(?:\\((?<installment>[^)]+)\\))?[\\s\\S]*?(?<approvedAt>\\d{2}/\\d{2} \\d{2}:\\d{2})\\s*(?<merchant>.+?)(?:\\s|$)"}',
    '{"defaults":{"installment":"일시불"}}',
    'ACTIVE', now(), now(), now()
WHERE NOT EXISTS (SELECT 1 FROM admin_rules WHERE issuer = 'KB' AND name = '카드 SMS 파싱 - KB');

INSERT INTO admin_rules (name, description, scope, issuer, condition_json, action_json, status, activated_at, created_at, updated_at)
SELECT
    '카드 SMS 파싱 - SAMSUNG',
    '삼성카드 승인 SMS 파싱 (amount, merchant, approvedAt, installment)',
    'CARD_ISSUER',
    'SAMSUNG',
    '{"type":"regex","pattern":"삼성(?:카드)?[\\s\\S]*?(?<amount>\\d[\\d,]*)원\\s*(?:\\((?<installment>[^)]+)\\))?[\\s\\S]*?(?<approvedAt>\\d{2}/\\d{2} \\d{2}:\\d{2})\\s*(?<merchant>.+?)(?:\\s|$)"}',
    '{"defaults":{"installment":"일시불"}}',
    'ACTIVE', now(), now(), now()
WHERE NOT EXISTS (SELECT 1 FROM admin_rules WHERE issuer = 'SAMSUNG' AND name = '카드 SMS 파싱 - SAMSUNG');

INSERT INTO admin_rules (name, description, scope, issuer, condition_json, action_json, status, activated_at, created_at, updated_at)
SELECT
    '카드 SMS 파싱 - HYUNDAI',
    '현대카드 승인 SMS 파싱 (amount, merchant, approvedAt, installment)',
    'CARD_ISSUER',
    'HYUNDAI',
    '{"type":"regex","pattern":"현대(?:카드)?[\\s\\S]*?(?<amount>\\d[\\d,]*)원\\s*(?:\\((?<installment>[^)]+)\\))?[\\s\\S]*?(?<approvedAt>\\d{2}/\\d{2} \\d{2}:\\d{2})\\s*(?<merchant>.+?)(?:\\s|$)"}',
    '{"defaults":{"installment":"일시불"}}',
    'ACTIVE', now(), now(), now()
WHERE NOT EXISTS (SELECT 1 FROM admin_rules WHERE issuer = 'HYUNDAI' AND name = '카드 SMS 파싱 - HYUNDAI');

INSERT INTO admin_rules (name, description, scope, issuer, condition_json, action_json, status, activated_at, created_at, updated_at)
SELECT
    '카드 SMS 파싱 - WOORI',
    '우리카드 승인 SMS 파싱 (amount, merchant, approvedAt, installment)',
    'CARD_ISSUER',
    'WOORI',
    '{"type":"regex","pattern":"우리(?:카드)?[\\s\\S]*?(?<amount>\\d[\\d,]*)원\\s*(?:\\((?<installment>[^)]+)\\))?[\\s\\S]*?(?<approvedAt>\\d{2}/\\d{2} \\d{2}:\\d{2})\\s*(?<merchant>.+?)(?:\\s|$)"}',
    '{"defaults":{"installment":"일시불"}}',
    'ACTIVE', now(), now(), now()
WHERE NOT EXISTS (SELECT 1 FROM admin_rules WHERE issuer = 'WOORI' AND name = '카드 SMS 파싱 - WOORI');

INSERT INTO admin_rules (name, description, scope, issuer, condition_json, action_json, status, activated_at, created_at, updated_at)
SELECT
    '카드 SMS 파싱 - NH',
    'NH카드 승인 SMS 파싱 (amount, merchant, approvedAt, installment)',
    'CARD_ISSUER',
    'NH',
    '{"type":"regex","pattern":"(?:NH|농협)(?:카드)?[\\s\\S]*?(?<amount>\\d[\\d,]*)원\\s*(?:\\((?<installment>[^)]+)\\))?[\\s\\S]*?(?<approvedAt>\\d{2}/\\d{2} \\d{2}:\\d{2})\\s*(?<merchant>.+?)(?:\\s|$)"}',
    '{"defaults":{"installment":"일시불"}}',
    'ACTIVE', now(), now(), now()
WHERE NOT EXISTS (SELECT 1 FROM admin_rules WHERE issuer = 'NH' AND name = '카드 SMS 파싱 - NH');

INSERT INTO admin_rules (name, description, scope, issuer, condition_json, action_json, status, activated_at, created_at, updated_at)
SELECT
    '카드 SMS 파싱 - BC',
    'BC카드 승인 SMS 파싱 (amount, merchant, approvedAt, installment)',
    'CARD_ISSUER',
    'BC',
    '{"type":"regex","pattern":"BC(?:카드)?[\\s\\S]*?(?<amount>\\d[\\d,]*)원\\s*(?:\\((?<installment>[^)]+)\\))?[\\s\\S]*?(?<approvedAt>\\d{2}/\\d{2} \\d{2}:\\d{2})\\s*(?<merchant>.+?)(?:\\s|$)"}',
    '{"defaults":{"installment":"일시불"}}',
    'ACTIVE', now(), now(), now()
WHERE NOT EXISTS (SELECT 1 FROM admin_rules WHERE issuer = 'BC' AND name = '카드 SMS 파싱 - BC');
