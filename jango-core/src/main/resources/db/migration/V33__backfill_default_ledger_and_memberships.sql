-- Backfill strategy for multi-ledger rollout
-- - Ensure every user has at least one ledger
-- - Backfill ledgers.owner_user_id from existing ledgers.user_id
-- - Set users.default_ledger_id
-- - Seed owner memberships
-- - Populate transaction author metadata for legacy rows

-- 1) Create a default ledger for users without any ledger
INSERT INTO ledgers (user_id, owner_user_id, name, description, fiscal_start, created_at, updated_at)
SELECT
    u.id,
    u.id,
    '기본 장부',
    '자동 생성된 기본 장부',
    1,
    now(),
    now()
FROM users u
WHERE NOT EXISTS (
    SELECT 1
    FROM ledgers l
    WHERE l.user_id = u.id
);

-- 2) Backfill owner_user_id for legacy ledgers
UPDATE ledgers
SET owner_user_id = user_id
WHERE owner_user_id IS NULL;

-- 3) Backfill default ledger (oldest owned ledger)
UPDATE users u
SET default_ledger_id = s.ledger_id
FROM (
    SELECT DISTINCT ON (l.user_id)
        l.user_id,
        l.id AS ledger_id
    FROM ledgers l
    ORDER BY l.user_id, l.created_at, l.id
) s
WHERE s.user_id = u.id
  AND u.default_ledger_id IS NULL;

-- 4) Seed owner memberships for existing ledgers
INSERT INTO ledger_memberships (
    ledger_id,
    user_id,
    role,
    status,
    invited_by_user_id,
    joined_at,
    created_at,
    updated_at
)
SELECT
    l.id,
    l.owner_user_id,
    'OWNER',
    'ACTIVE',
    NULL,
    COALESCE(l.created_at, now()),
    now(),
    now()
FROM ledgers l
WHERE l.owner_user_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1
      FROM ledger_memberships lm
      WHERE lm.ledger_id = l.id
        AND lm.user_id = l.owner_user_id
  );

-- 5) Backfill transaction created_by_user_id from ledger owner for legacy transactions
UPDATE transactions t
SET created_by_user_id = l.owner_user_id,
    last_modified_by_user_id = COALESCE(t.last_modified_by_user_id, l.owner_user_id)
FROM ledgers l
WHERE l.id = t.ledger_id
  AND (t.created_by_user_id IS NULL OR t.last_modified_by_user_id IS NULL);

-- 6) Keep legacy insert compatibility: if owner_user_id is omitted,
--    fall back to existing user_id before NOT NULL validation.
CREATE OR REPLACE FUNCTION set_ledger_owner_user_id_from_user_id()
RETURNS trigger AS $$
BEGIN
    IF NEW.owner_user_id IS NULL THEN
        NEW.owner_user_id := NEW.user_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_ledger_owner_user_id_from_user_id ON ledgers;

CREATE TRIGGER trg_set_ledger_owner_user_id_from_user_id
    BEFORE INSERT OR UPDATE ON ledgers
    FOR EACH ROW
    WHEN (NEW.owner_user_id IS NULL)
EXECUTE FUNCTION set_ledger_owner_user_id_from_user_id();

-- 7) Strengthen ownership invariant once data is backfilled
ALTER TABLE ledgers
    ALTER COLUMN owner_user_id SET NOT NULL;
