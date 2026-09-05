CREATE TABLE IF NOT EXISTS job_request_idempotency (
    id BIGSERIAL PRIMARY KEY,
    action VARCHAR(80) NOT NULL,
    idempotency_key VARCHAR(160) NOT NULL,
    request_hash VARCHAR(128) NOT NULL,
    response_body TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'uk_job_request_idempotency_action_key'
    ) THEN
        ALTER TABLE job_request_idempotency
            ADD CONSTRAINT uk_job_request_idempotency_action_key UNIQUE (action, idempotency_key);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_job_request_idempotency_created_at ON job_request_idempotency(created_at);
