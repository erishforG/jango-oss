ALTER TABLE email_deliveries
    ADD COLUMN IF NOT EXISTS retry_count INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uk_email_deliveries_monthly_report_id'
    ) THEN
        ALTER TABLE email_deliveries
            ADD CONSTRAINT uk_email_deliveries_monthly_report_id UNIQUE (monthly_report_id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_email_deliveries_next_retry_at ON email_deliveries(next_retry_at);
