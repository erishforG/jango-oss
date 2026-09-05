ALTER TABLE ledgers
    ADD COLUMN deleted_at TIMESTAMPTZ;

CREATE INDEX idx_ledgers_deleted_at ON ledgers(deleted_at);
