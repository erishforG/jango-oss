-- Step 1: 파싱 추적용 컬럼 추가
ALTER TABLE transaction_drafts ADD COLUMN matched_rule_id BIGINT REFERENCES admin_rules(id) ON DELETE SET NULL;
ALTER TABLE transactions ADD COLUMN draft_id BIGINT REFERENCES transaction_drafts(id) ON DELETE SET NULL;

CREATE INDEX idx_transaction_drafts_matched_rule_id ON transaction_drafts(matched_rule_id);
CREATE INDEX idx_transactions_draft_id ON transactions(draft_id);
