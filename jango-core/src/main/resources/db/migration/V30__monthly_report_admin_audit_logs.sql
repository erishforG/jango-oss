CREATE TABLE IF NOT EXISTS monthly_report_admin_audit_logs (
    id BIGSERIAL PRIMARY KEY,
    action_type VARCHAR(50) NOT NULL,
    actor VARCHAR(255) NOT NULL,
    target_type VARCHAR(50) NOT NULL,
    target_id VARCHAR(100),
    idempotency_key VARCHAR(255),
    success BOOLEAN NOT NULL DEFAULT TRUE,
    detail JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_monthly_report_admin_audit_logs_action_key
    ON monthly_report_admin_audit_logs (action_type, idempotency_key)
    WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_monthly_report_admin_audit_logs_created_at
    ON monthly_report_admin_audit_logs (created_at DESC);
