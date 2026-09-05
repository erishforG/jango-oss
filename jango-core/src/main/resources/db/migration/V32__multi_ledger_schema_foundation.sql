-- Multi-ledger foundation schema
-- 1) Extend ledgers ownership model (keep user_id for backward compatibility)
-- 2) Add collaboration tables: ledger_memberships, ledger_invites, ledger_audit_logs
-- 3) Add user default ledger pointer
-- 4) Extend transactions for collaborative/idempotent writes

ALTER TABLE ledgers
    ADD COLUMN owner_user_id BIGINT;

ALTER TABLE ledgers
    ADD CONSTRAINT fk_ledgers_owner_user
    FOREIGN KEY (owner_user_id) REFERENCES users(id);

CREATE INDEX idx_ledgers_owner_user_id ON ledgers(owner_user_id);

CREATE TABLE ledger_memberships (
    id                  BIGSERIAL PRIMARY KEY,
    ledger_id           BIGINT NOT NULL REFERENCES ledgers(id) ON DELETE CASCADE,
    user_id             BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role                VARCHAR(20) NOT NULL CHECK (role IN ('OWNER', 'ADMIN', 'EDITOR', 'VIEWER')),
    status              VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'LEFT', 'REMOVED')),
    invited_by_user_id  BIGINT REFERENCES users(id),
    joined_at           TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (ledger_id, user_id)
);

CREATE INDEX idx_ledger_memberships_user_id ON ledger_memberships(user_id);
CREATE INDEX idx_ledger_memberships_ledger_status ON ledger_memberships(ledger_id, status);

CREATE TABLE ledger_invites (
    id                  BIGSERIAL PRIMARY KEY,
    ledger_id           BIGINT NOT NULL REFERENCES ledgers(id) ON DELETE CASCADE,
    email               VARCHAR(255) NOT NULL,
    role                VARCHAR(20) NOT NULL CHECK (role IN ('ADMIN', 'EDITOR', 'VIEWER')),
    token               VARCHAR(128) NOT NULL UNIQUE,
    status              VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED')),
    invited_by_user_id  BIGINT NOT NULL REFERENCES users(id),
    accepted_by_user_id BIGINT REFERENCES users(id),
    expires_at          TIMESTAMPTZ,
    accepted_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ledger_invites_ledger_id ON ledger_invites(ledger_id);
CREATE INDEX idx_ledger_invites_email ON ledger_invites(lower(email));
CREATE INDEX idx_ledger_invites_status_expires_at ON ledger_invites(status, expires_at);

CREATE UNIQUE INDEX ux_ledger_invites_pending_email
    ON ledger_invites(ledger_id, lower(email))
    WHERE status = 'PENDING';

CREATE TABLE ledger_audit_logs (
    id              BIGSERIAL PRIMARY KEY,
    ledger_id       BIGINT NOT NULL REFERENCES ledgers(id) ON DELETE CASCADE,
    actor_user_id   BIGINT REFERENCES users(id),
    action          VARCHAR(80) NOT NULL,
    target_type     VARCHAR(40),
    target_id       VARCHAR(100),
    metadata        JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ledger_audit_logs_ledger_created_at ON ledger_audit_logs(ledger_id, created_at DESC);
CREATE INDEX idx_ledger_audit_logs_actor_user_id ON ledger_audit_logs(actor_user_id);
CREATE INDEX idx_ledger_audit_logs_action ON ledger_audit_logs(action);

ALTER TABLE users
    ADD COLUMN default_ledger_id BIGINT;

ALTER TABLE users
    ADD CONSTRAINT fk_users_default_ledger
    FOREIGN KEY (default_ledger_id) REFERENCES ledgers(id);

CREATE INDEX idx_users_default_ledger_id ON users(default_ledger_id);

ALTER TABLE transactions
    ADD COLUMN created_by_user_id BIGINT REFERENCES users(id),
    ADD COLUMN last_modified_by_user_id BIGINT REFERENCES users(id),
    ADD COLUMN client_request_id VARCHAR(64),
    ADD COLUMN external_ref VARCHAR(128);

CREATE INDEX idx_transactions_created_by_user_id ON transactions(created_by_user_id);
CREATE INDEX idx_transactions_last_modified_by_user_id ON transactions(last_modified_by_user_id);
CREATE INDEX idx_transactions_ledger_created_at ON transactions(ledger_id, created_at DESC);
CREATE UNIQUE INDEX ux_transactions_ledger_client_request_id
    ON transactions(ledger_id, client_request_id)
    WHERE client_request_id IS NOT NULL;
CREATE INDEX idx_transactions_ledger_external_ref
    ON transactions(ledger_id, external_ref)
    WHERE external_ref IS NOT NULL;
