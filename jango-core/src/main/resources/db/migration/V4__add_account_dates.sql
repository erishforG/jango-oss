ALTER TABLE accounts ADD COLUMN start_date DATE;
ALTER TABLE accounts ADD COLUMN end_date DATE;
UPDATE accounts SET display_order = 0 WHERE display_order IS NULL;
ALTER TABLE accounts ALTER COLUMN display_order SET DEFAULT 0;
ALTER TABLE accounts ALTER COLUMN display_order SET NOT NULL;
