ALTER TABLE users ADD COLUMN webhook_token VARCHAR(64);
CREATE UNIQUE INDEX uq_users_webhook_token ON users(webhook_token);
