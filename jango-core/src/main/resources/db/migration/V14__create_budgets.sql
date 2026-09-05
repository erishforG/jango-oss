CREATE TABLE budgets (
    id BIGSERIAL PRIMARY KEY,
    ledger_id BIGINT NOT NULL REFERENCES ledgers(id),
    account_id BIGINT NOT NULL REFERENCES accounts(id),
    year_month VARCHAR(7) NOT NULL,
    amount DECIMAL(18,2) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now(),
    UNIQUE(ledger_id, account_id, year_month)
);

CREATE INDEX idx_budgets_ledger_month ON budgets(ledger_id, year_month);
