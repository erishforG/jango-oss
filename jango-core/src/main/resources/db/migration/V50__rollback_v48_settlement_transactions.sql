-- V50: Rollback V48 settlement transactions (이중 차감 문제)
-- V48이 기존 데이터에 정산 거래를 추가했으나, 원래 데이터는 이미 통장 잔액이 반영된 상태였음
-- → 이중 차감 발생 → 정산 거래 전부 삭제

-- 1) V48 마이그레이션으로 생성된 정산 거래의 엔트리 삭제
DELETE FROM entries
WHERE transaction_id IN (
    SELECT id FROM transactions WHERE source = 'migration_v48'
);

-- 2) V48 마이그레이션으로 생성된 정산 거래 삭제
DELETE FROM transactions WHERE source = 'migration_v48';

-- 3) auto_settlement로 생성된 정산 거래의 엔트리 삭제
DELETE FROM entries
WHERE transaction_id IN (
    SELECT id FROM transactions WHERE source = 'auto_settlement'
);

-- 4) auto_settlement로 생성된 정산 거래 삭제
DELETE FROM transactions WHERE source = 'auto_settlement';

-- 5) V49에서 추가된 debit-card-pair 태그 제거 (원본 거래에서)
UPDATE transactions
SET tags = NULL
WHERE tags IS NOT NULL
  AND 'debit-card-pair' = ANY(tags);
