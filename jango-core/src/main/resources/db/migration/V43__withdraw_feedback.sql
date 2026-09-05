CREATE TABLE IF NOT EXISTS withdraw_feedback (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT,
    email VARCHAR(320) NOT NULL,
    reason VARCHAR(64),
    detail TEXT,
    source VARCHAR(32) NOT NULL DEFAULT 'SELF',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_withdraw_feedback_created_at ON withdraw_feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_withdraw_feedback_reason ON withdraw_feedback(reason);
