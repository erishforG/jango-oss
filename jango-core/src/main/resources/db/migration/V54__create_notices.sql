CREATE TABLE IF NOT EXISTS notices (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(120) NOT NULL,
    body TEXT NOT NULL,
    severity VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL,
    start_at TIMESTAMPTZ,
    end_at TIMESTAMPTZ,
    cta_label VARCHAR(40),
    cta_url VARCHAR(500),
    created_by BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_notices_severity CHECK (severity IN ('CRITICAL', 'IMPORTANT', 'INFO')),
    CONSTRAINT chk_notices_status CHECK (status IN ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED')),
    CONSTRAINT chk_notices_period CHECK (end_at IS NULL OR start_at IS NULL OR end_at >= start_at)
);

CREATE INDEX IF NOT EXISTS idx_notices_status_start_end ON notices (status, start_at, end_at);
CREATE INDEX IF NOT EXISTS idx_notices_created_at ON notices (created_at DESC);

CREATE TABLE IF NOT EXISTS notice_reads (
    id BIGSERIAL PRIMARY KEY,
    notice_id BIGINT NOT NULL REFERENCES notices (id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL,
    read_at TIMESTAMPTZ,
    dismissed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_notice_reads_user_notice UNIQUE (user_id, notice_id)
);

CREATE INDEX IF NOT EXISTS idx_notice_reads_user_notice ON notice_reads (user_id, notice_id);
