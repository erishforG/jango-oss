UPDATE transactions t
SET created_by_user_id = COALESCE(t.created_by_user_id, l.user_id)
FROM ledgers l
WHERE t.ledger_id = l.id
  AND t.created_by_user_id IS NULL;

ALTER TABLE transactions
    ALTER COLUMN created_by_user_id SET NOT NULL;
