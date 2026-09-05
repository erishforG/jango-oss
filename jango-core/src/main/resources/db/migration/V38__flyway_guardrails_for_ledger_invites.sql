DO $$
DECLARE
    rec RECORD;
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'ledger_invites'
    ) THEN
        -- 1) link-share invites require nullable email
        IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'ledger_invites'
              AND column_name = 'email'
              AND is_nullable = 'NO'
        ) THEN
            ALTER TABLE ledger_invites
                ALTER COLUMN email DROP NOT NULL;
        END IF;

        -- 2) drop any status-check constraints regardless of historical name
        FOR rec IN
            SELECT con.conname
            FROM pg_constraint con
            JOIN pg_class rel ON rel.oid = con.conrelid
            JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
            WHERE nsp.nspname = 'public'
              AND rel.relname = 'ledger_invites'
              AND con.contype = 'c'
              AND pg_get_constraintdef(con.oid) ILIKE '%status%'
        LOOP
            EXECUTE format('ALTER TABLE ledger_invites DROP CONSTRAINT IF EXISTS %I', rec.conname);
        END LOOP;

        -- 3) normalize invite status domain
        ALTER TABLE ledger_invites
            ADD CONSTRAINT ledger_invites_status_check
            CHECK (status IN ('PENDING', 'ACCEPTED', 'DECLINED', 'REVOKED', 'EXPIRED'));

        -- 4) ensure token uniqueness path exists for lookup stability
        CREATE UNIQUE INDEX IF NOT EXISTS ux_ledger_invites_token ON ledger_invites(token);
    END IF;
END
$$;