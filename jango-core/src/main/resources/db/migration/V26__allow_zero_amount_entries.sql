-- Allow zero-amount entries for opening-balance rows imported from Whooing CSV.
ALTER TABLE entries DROP CONSTRAINT IF EXISTS entries_amount_check;
ALTER TABLE entries ADD CONSTRAINT entries_amount_check CHECK (amount >= 0);
