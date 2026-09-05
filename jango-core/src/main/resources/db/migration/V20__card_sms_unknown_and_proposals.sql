CREATE TABLE IF NOT EXISTS card_sms_unknown_samples (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NULL REFERENCES users(id),
    parse_status VARCHAR(20) NOT NULL DEFAULT 'UNKNOWN',
    raw_message TEXT NOT NULL,
    guessed_issuer VARCHAR(50),
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_card_sms_unknown_samples_created_at
    ON card_sms_unknown_samples (created_at DESC);

CREATE TABLE IF NOT EXISTS card_sms_rule_proposals (
    id BIGSERIAL PRIMARY KEY,
    unknown_sample_id BIGINT NOT NULL REFERENCES card_sms_unknown_samples(id) ON DELETE CASCADE,
    issuer VARCHAR(50) NOT NULL,
    amount NUMERIC(18, 4) NOT NULL,
    merchant VARCHAR(200) NOT NULL,
    approved_at VARCHAR(30) NOT NULL,
    installment VARCHAR(50) NOT NULL DEFAULT '일시불',
    confidence NUMERIC(5, 4) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_card_sms_rule_proposals_status_created_at
    ON card_sms_rule_proposals (status, created_at DESC);

CREATE TABLE IF NOT EXISTS card_sms_ai_audit_logs (
    id BIGSERIAL PRIMARY KEY,
    unknown_sample_id BIGINT REFERENCES card_sms_unknown_samples(id) ON DELETE SET NULL,
    proposal_id BIGINT REFERENCES card_sms_rule_proposals(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL,
    success BOOLEAN NOT NULL,
    reason VARCHAR(500),
    detail JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_card_sms_ai_audit_logs_created_at
    ON card_sms_ai_audit_logs (created_at DESC);
