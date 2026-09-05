DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'ledger_invites'
    ) THEN
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

        ALTER TABLE ledger_invites
            DROP CONSTRAINT IF EXISTS ledger_invites_status_check;

        ALTER TABLE ledger_invites
            ADD CONSTRAINT ledger_invites_status_check
            CHECK (status IN ('PENDING', 'ACCEPTED', 'DECLINED', 'REVOKED', 'EXPIRED'));
    END IF;
END
$$;