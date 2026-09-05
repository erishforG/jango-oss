CREATE TABLE IF NOT EXISTS monthly_reports (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    period_ym VARCHAR(7) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    report_data TEXT,
    generated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'uk_monthly_reports_user_period_ym'
    ) THEN
        ALTER TABLE monthly_reports
            ADD CONSTRAINT uk_monthly_reports_user_period_ym UNIQUE (user_id, period_ym);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_monthly_reports_user_id ON monthly_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_monthly_reports_status ON monthly_reports(status);

CREATE TABLE IF NOT EXISTS email_deliveries (
    id BIGSERIAL PRIMARY KEY,
    monthly_report_id BIGINT NOT NULL REFERENCES monthly_reports(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    provider VARCHAR(50),
    provider_message_id VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    error_message TEXT,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_deliveries_monthly_report_id ON email_deliveries(monthly_report_id);
CREATE INDEX IF NOT EXISTS idx_email_deliveries_user_id ON email_deliveries(user_id);
CREATE INDEX IF NOT EXISTS idx_email_deliveries_status ON email_deliveries(status);

CREATE TABLE IF NOT EXISTS user_notification_prefs (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    monthly_report_email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'uk_user_notification_prefs_user_id'
    ) THEN
        ALTER TABLE user_notification_prefs
            ADD CONSTRAINT uk_user_notification_prefs_user_id UNIQUE (user_id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_notification_prefs_user_id ON user_notification_prefs(user_id);
