-- 성능 최적화 인덱스
-- 대량 데이터(수천 건 임포트) 시 조회 성능 개선

-- 1. entries: 계정별 차변/대변 합계 조회용
CREATE INDEX idx_entries_account_type ON entries (account_id, type);

-- 2. transactions: 최신 거래 페이지네이션용 (날짜 역순)
CREATE INDEX idx_transactions_ledger_date_desc ON transactions (ledger_id, date DESC, id DESC);

-- 3. entries: transaction 조인 최적화 (복합 인덱스)
CREATE INDEX idx_entries_txn_account ON entries (transaction_id, account_id);

-- 4. transactions: source 필터용 (csv-import, opening-balance 등)
CREATE INDEX idx_transactions_ledger_source ON transactions (ledger_id, source);

-- 5. accounts: 유형별 계정 조회용
CREATE INDEX idx_accounts_ledger_type ON accounts (ledger_id, type);
