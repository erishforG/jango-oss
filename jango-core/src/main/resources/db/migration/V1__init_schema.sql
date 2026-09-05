-- 복식부기 가계부 초기 스키마
-- 기획서 §10.2 기반

CREATE TABLE users (
    id              BIGSERIAL PRIMARY KEY,
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(255),
    display_name    VARCHAR(100),
    locale          VARCHAR(5) DEFAULT 'ko',
    base_currency   VARCHAR(3) NOT NULL DEFAULT 'KRW',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE ledgers (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES users(id),
    name            VARCHAR(100) NOT NULL,
    description     TEXT,
    fiscal_start    INT NOT NULL DEFAULT 1,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ledgers_user_id ON ledgers(user_id);

CREATE TABLE accounts (
    id              BIGSERIAL PRIMARY KEY,
    ledger_id       BIGINT NOT NULL REFERENCES ledgers(id),
    parent_id       BIGINT REFERENCES accounts(id),
    name            VARCHAR(100) NOT NULL,
    type            VARCHAR(20) NOT NULL CHECK (type IN ('ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE')),
    currency        VARCHAR(3),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    display_order   INT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_accounts_ledger_id ON accounts(ledger_id);
CREATE INDEX idx_accounts_parent_id ON accounts(parent_id);

CREATE TABLE transactions (
    id              BIGSERIAL PRIMARY KEY,
    ledger_id       BIGINT NOT NULL REFERENCES ledgers(id),
    date            DATE NOT NULL,
    description     VARCHAR(500),
    memo            TEXT,
    tags            VARCHAR[],
    source          VARCHAR(20),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_transactions_ledger_date ON transactions(ledger_id, date);

CREATE TABLE entries (
    id              BIGSERIAL PRIMARY KEY,
    transaction_id  BIGINT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    account_id      BIGINT NOT NULL REFERENCES accounts(id),
    type            VARCHAR(2) NOT NULL CHECK (type IN ('DR', 'CR')),
    amount          NUMERIC(18, 4) NOT NULL CHECK (amount > 0),
    currency        VARCHAR(3) NOT NULL,
    base_amount     NUMERIC(18, 4) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_entries_transaction_id ON entries(transaction_id);
CREATE INDEX idx_entries_account_id ON entries(account_id);

CREATE TABLE reconciliations (
    id              BIGSERIAL PRIMARY KEY,
    account_id      BIGINT NOT NULL REFERENCES accounts(id),
    statement_date  DATE,
    statement_bal   NUMERIC(18, 4),
    ledger_bal      NUMERIC(18, 4),
    status          VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'MATCHED', 'ADJUSTED')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reconciliations_account_id ON reconciliations(account_id);

CREATE TABLE import_sources (
    id              BIGSERIAL PRIMARY KEY,
    ledger_id       BIGINT NOT NULL REFERENCES ledgers(id),
    type            VARCHAR(20) NOT NULL,
    metadata        JSONB,
    imported_at     TIMESTAMPTZ,
    record_count    INT
);

CREATE INDEX idx_import_sources_ledger_id ON import_sources(ledger_id);

CREATE TABLE ai_suggestions (
    id                  BIGSERIAL PRIMARY KEY,
    transaction_id      BIGINT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    suggested_entries   JSONB,
    confidence          NUMERIC(3, 2),
    accepted            BOOLEAN,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_suggestions_transaction_id ON ai_suggestions(transaction_id);

-- 차변/대변 밸런스 검증 트리거
CREATE OR REPLACE FUNCTION check_entry_balance()
RETURNS TRIGGER AS $$
DECLARE
    dr_sum NUMERIC(18, 4);
    cr_sum NUMERIC(18, 4);
BEGIN
    SELECT
        COALESCE(SUM(CASE WHEN type = 'DR' THEN base_amount ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN type = 'CR' THEN base_amount ELSE 0 END), 0)
    INTO dr_sum, cr_sum
    FROM entries
    WHERE transaction_id = NEW.transaction_id;

    IF dr_sum <> cr_sum THEN
        RAISE EXCEPTION 'Entry balance mismatch: DR(%) <> CR(%)', dr_sum, cr_sum;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER trg_check_entry_balance
    AFTER INSERT OR UPDATE ON entries
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW
    EXECUTE FUNCTION check_entry_balance();
