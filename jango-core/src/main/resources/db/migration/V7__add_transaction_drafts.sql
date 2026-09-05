CREATE TABLE transaction_drafts (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES users(id),
    source          VARCHAR(50) NOT NULL,
    occurred_on     DATE,
    amount          NUMERIC(18, 4) NOT NULL CHECK (amount > 0),
    currency        VARCHAR(3) NOT NULL,
    description     VARCHAR(500),
    payload         JSONB NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'RECEIVED' CHECK (status IN ('RECEIVED', 'APPLIED', 'DISCARDED')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_transaction_drafts_user_id ON transaction_drafts(user_id);
CREATE INDEX idx_transaction_drafts_user_status ON transaction_drafts(user_id, status);
