ALTER TABLE ledger_invites
    ALTER COLUMN email DROP NOT NULL;

ALTER TABLE ledger_invites
    DROP CONSTRAINT IF EXISTS ledger_invites_status_check;

ALTER TABLE ledger_invites
    ADD CONSTRAINT ledger_invites_status_check
    CHECK (status IN ('PENDING', 'ACCEPTED', 'DECLINED', 'REVOKED', 'EXPIRED'));
