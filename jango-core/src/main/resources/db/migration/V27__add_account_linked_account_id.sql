ALTER TABLE accounts
    ADD COLUMN IF NOT EXISTS linked_account_id BIGINT;

CREATE INDEX IF NOT EXISTS idx_accounts_linked_account_id ON accounts(linked_account_id);
