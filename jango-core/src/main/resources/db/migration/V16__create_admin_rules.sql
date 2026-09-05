CREATE TABLE admin_rules (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(500),
    scope VARCHAR(30) NOT NULL,
    issuer VARCHAR(50) NOT NULL,
    condition_json TEXT NOT NULL,
    action_json TEXT NOT NULL,
    status VARCHAR(30) NOT NULL,
    activated_at TIMESTAMP,
    deprecated_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_rules_status ON admin_rules(status);
CREATE INDEX idx_admin_rules_issuer ON admin_rules(issuer);
