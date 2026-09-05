ALTER TABLE transaction_drafts
    DROP CONSTRAINT IF EXISTS transaction_drafts_status_check;

ALTER TABLE transaction_drafts
    ADD CONSTRAINT transaction_drafts_status_check
        CHECK (status IN ('RECEIVED', 'REPROCESSING', 'APPLIED', 'DISCARDED'));

ALTER TABLE transaction_drafts
    ADD COLUMN IF NOT EXISTS reprocess_count INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_reprocess_idempotency_key VARCHAR(128);