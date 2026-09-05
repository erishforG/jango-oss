-- Issue #86: 백엔드 성능 최적화용 인덱스
-- 캐시 없이 조회/집계 쿼리 효율화

CREATE INDEX IF NOT EXISTS idx_accounts_ledger_display_order
    ON accounts(ledger_id, display_order);

CREATE INDEX IF NOT EXISTS idx_accounts_ledger_parent
    ON accounts(ledger_id, parent_id);

CREATE INDEX IF NOT EXISTS idx_entries_transaction_account
    ON entries(transaction_id, account_id);
