CREATE TABLE IF NOT EXISTS ledger_notes (
    id BIGSERIAL PRIMARY KEY,
    ledger_id BIGINT NOT NULL REFERENCES ledgers(id) ON DELETE CASCADE,
    author_user_id BIGINT NOT NULL REFERENCES users(id),
    body TEXT NOT NULL,
    pinned BOOLEAN NOT NULL DEFAULT FALSE,
    resolved BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_ledger_notes_body_not_blank CHECK (length(btrim(body)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_ledger_notes_ledger_visibility
    ON ledger_notes (ledger_id, deleted_at, resolved, pinned, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ledger_notes_author_user_id
    ON ledger_notes (author_user_id);
