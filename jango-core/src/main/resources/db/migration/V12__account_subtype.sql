ALTER TABLE accounts ADD COLUMN subtype VARCHAR(20);
ALTER TABLE accounts ADD COLUMN settlement_day INTEGER;
ALTER TABLE accounts ADD COLUMN billing_start_day INTEGER;
ALTER TABLE accounts ADD COLUMN billing_duration_months INTEGER DEFAULT 1;
ALTER TABLE accounts ADD COLUMN memo TEXT;
