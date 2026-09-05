CREATE INDEX IF NOT EXISTS idx_transactions_ledger_date_consumer_user
    ON transactions(ledger_id, date, consumer_user_id);

CREATE INDEX IF NOT EXISTS idx_transactions_ledger_date_consumer_tag
    ON transactions(ledger_id, date, consumer_tag);
