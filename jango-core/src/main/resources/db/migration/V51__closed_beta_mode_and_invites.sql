CREATE TABLE IF NOT EXISTS app_settings (
    setting_key VARCHAR(100) PRIMARY KEY,
    setting_value VARCHAR(500) NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO app_settings (setting_key, setting_value, updated_at)
VALUES ('closed_beta_enabled', 'false', NOW())
ON CONFLICT (setting_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS beta_invites (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    revoked_at TIMESTAMPTZ,
    revoked_by VARCHAR(100),
    created_by VARCHAR(100) NOT NULL DEFAULT 'admin',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_beta_invites_revoked_at ON beta_invites (revoked_at);
