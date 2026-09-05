-- Issue #425 validation queries
-- Run after V32/V33 migration in staging/production.

-- 1) Every user has default ledger
SELECT COUNT(*) AS users_without_default_ledger
FROM users
WHERE default_ledger_id IS NULL;

-- 2) default_ledger_id points to existing ledger
SELECT COUNT(*) AS broken_default_ledger_fk
FROM users u
LEFT JOIN ledgers l ON l.id = u.default_ledger_id
WHERE u.default_ledger_id IS NOT NULL
  AND l.id IS NULL;

-- 3) Every ledger has owner
SELECT COUNT(*) AS ledgers_without_owner
FROM ledgers
WHERE owner_user_id IS NULL;

-- 4) Every ledger has owner membership
SELECT COUNT(*) AS ledgers_without_owner_membership
FROM ledgers l
LEFT JOIN ledger_memberships lm
    ON lm.ledger_id = l.id
   AND lm.user_id = l.owner_user_id
   AND lm.role = 'OWNER'
   AND lm.status = 'ACTIVE'
WHERE lm.id IS NULL;

-- 5) Duplicate memberships check
SELECT ledger_id, user_id, COUNT(*)
FROM ledger_memberships
GROUP BY ledger_id, user_id
HAVING COUNT(*) > 1;

-- 6) Transactions missing author metadata
SELECT COUNT(*) AS transactions_without_created_by
FROM transactions
WHERE created_by_user_id IS NULL;

-- 7) New index coverage check (manual EXPLAIN sample)
-- EXPLAIN ANALYZE
-- SELECT *
-- FROM transactions
-- WHERE ledger_id = :ledger_id
--   AND client_request_id = :client_request_id;
