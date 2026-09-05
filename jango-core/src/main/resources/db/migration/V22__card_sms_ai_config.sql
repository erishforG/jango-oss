CREATE TABLE IF NOT EXISTS card_sms_ai_configs (
    id BIGSERIAL PRIMARY KEY,
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    min_confidence NUMERIC(5, 4) NOT NULL DEFAULT 0.8500,
    review_cron VARCHAR(100) NOT NULL DEFAULT '0 0/30 * * * *',
    parsing_mode VARCHAR(20) NOT NULL DEFAULT 'CONSERVATIVE',
    issuer_priority_mode VARCHAR(20) NOT NULL DEFAULT 'MANUAL_ONLY',
    api_key_encrypted VARCHAR(1000),
    updated_by VARCHAR(100) NOT NULL DEFAULT 'system',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO card_sms_ai_configs (enabled, min_confidence, review_cron, parsing_mode, issuer_priority_mode, updated_by)
SELECT FALSE, 0.8500, '0 0/30 * * * *', 'CONSERVATIVE', 'MANUAL_ONLY', 'system'
WHERE NOT EXISTS (SELECT 1 FROM card_sms_ai_configs);
