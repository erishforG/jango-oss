ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS consumer_user_id BIGINT REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS consumer_tag VARCHAR(64);

CREATE INDEX IF NOT EXISTS idx_transactions_consumer_user_id ON transactions(consumer_user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_consumer_tag ON transactions(consumer_tag);
