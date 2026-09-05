CREATE TABLE items (
    id              BIGSERIAL PRIMARY KEY,
    account_id      BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    name            VARCHAR(100) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (account_id, name)
);

CREATE INDEX idx_items_account_id ON items(account_id);

ALTER TABLE entries ADD COLUMN item_id BIGINT REFERENCES items(id);
CREATE INDEX idx_entries_item_id ON entries(item_id);
