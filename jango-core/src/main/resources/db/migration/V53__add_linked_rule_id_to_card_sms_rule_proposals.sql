ALTER TABLE card_sms_rule_proposals
    ADD COLUMN IF NOT EXISTS linked_rule_id BIGINT;

CREATE INDEX IF NOT EXISTS idx_card_sms_rule_proposals_linked_rule_id
    ON card_sms_rule_proposals(linked_rule_id);
