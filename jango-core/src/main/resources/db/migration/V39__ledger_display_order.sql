ALTER TABLE ledgers
    ADD COLUMN IF NOT EXISTS display_order INT NOT NULL DEFAULT 0;

WITH ranked AS (
    SELECT
        l.id,
        ROW_NUMBER() OVER (PARTITION BY l.user_id ORDER BY l.created_at, l.id) AS rn
    FROM ledgers l
)
UPDATE ledgers l
SET display_order = ranked.rn
FROM ranked
WHERE l.id = ranked.id
  AND (l.display_order = 0 OR l.display_order IS NULL);

CREATE INDEX IF NOT EXISTS idx_ledgers_user_display_order ON ledgers(user_id, display_order);
