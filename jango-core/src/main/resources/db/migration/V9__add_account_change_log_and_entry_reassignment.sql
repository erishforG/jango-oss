CREATE TABLE account_change_logs (
    id                  BIGSERIAL PRIMARY KEY,
    ledger_id           BIGINT NOT NULL REFERENCES ledgers(id),
    action              VARCHAR(20) NOT NULL,
    source_account_id   BIGINT,
    target_account_id   BIGINT,
    new_account_id      BIGINT,
    moved_entry_count   INT NOT NULL DEFAULT 0,
    detail              TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_account_change_logs_ledger_id ON account_change_logs(ledger_id);
CREATE INDEX idx_account_change_logs_source_account_id ON account_change_logs(source_account_id);
CREATE INDEX idx_account_change_logs_target_account_id ON account_change_logs(target_account_id);
