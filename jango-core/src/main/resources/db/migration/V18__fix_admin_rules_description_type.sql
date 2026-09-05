DO $$
DECLARE
    description_udt text;
BEGIN
    SELECT c.udt_name
    INTO description_udt
    FROM information_schema.columns c
    WHERE c.table_schema = current_schema()
      AND c.table_name = 'admin_rules'
      AND c.column_name = 'description';

    IF description_udt = 'bytea' THEN
        BEGIN
            ALTER TABLE admin_rules
                ALTER COLUMN description TYPE VARCHAR(500)
                USING CASE
                    WHEN description IS NULL THEN NULL
                    ELSE convert_from(description, 'UTF8')
                END;
        EXCEPTION
            WHEN character_not_in_repertoire THEN
                ALTER TABLE admin_rules
                    ALTER COLUMN description TYPE VARCHAR(500)
                    USING CASE
                        WHEN description IS NULL THEN NULL
                        ELSE encode(description, 'escape')
                    END;
        END;
    ELSIF description_udt IS NOT NULL AND description_udt <> 'varchar' THEN
        ALTER TABLE admin_rules
            ALTER COLUMN description TYPE VARCHAR(500)
            USING description::varchar(500);
    END IF;
END $$;
