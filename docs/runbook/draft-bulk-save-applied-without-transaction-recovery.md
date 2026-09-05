# Runbook: `transaction_drafts` APPLIED but no `transactions` row recovery

## 목적
- 증상: `/api/drafts/bulk-save` 버그로 `transaction_drafts.status='APPLIED'` 이지만 `transactions.draft_id`가 없는 레코드 발생
- 원칙: **코드 핫픽스와 데이터 복구는 분리**하여 운영자가 별도 실행

## 0) 필수 주의사항
- 운영 DB 전체 백업(또는 최소 대상 테이블 백업) 후 진행
- 반드시 트랜잭션으로 실행하고, 검증 완료 전 `COMMIT` 금지
- 배치 영향 건수가 예상과 다르면 즉시 `ROLLBACK`

---

## 1) 영향 건수 조회 SQL
```sql
-- 장부별/전체 영향 건수 확인
SELECT
  d.user_id,
  COUNT(*) AS affected_count
FROM transaction_drafts d
LEFT JOIN transactions t ON t.draft_id = d.id
WHERE d.status = 'APPLIED'
  AND t.id IS NULL
GROUP BY d.user_id
ORDER BY affected_count DESC;

-- 전체 합계
SELECT COUNT(*) AS affected_total
FROM transaction_drafts d
LEFT JOIN transactions t ON t.draft_id = d.id
WHERE d.status = 'APPLIED'
  AND t.id IS NULL;
```

## 2) 복구 대상 조건
```sql
-- 복구 대상 샘플 점검
SELECT d.id, d.user_id, d.status, d.created_at
FROM transaction_drafts d
LEFT JOIN transactions t ON t.draft_id = d.id
WHERE d.status = 'APPLIED'
  AND t.id IS NULL
ORDER BY d.id DESC
LIMIT 100;
```

## 3) 안전 복구 SQL (RECEIVED로 롤백)
```sql
BEGIN;

-- 3-1. 백업 테이블 생성 (최초 1회)
CREATE TABLE IF NOT EXISTS backup_transaction_drafts_recovery_20260405 AS
SELECT *
FROM transaction_drafts
WHERE 1 = 0;

-- 3-2. 이번 작업 대상 백업 적재
INSERT INTO backup_transaction_drafts_recovery_20260405
SELECT d.*
FROM transaction_drafts d
LEFT JOIN transactions t ON t.draft_id = d.id
WHERE d.status = 'APPLIED'
  AND t.id IS NULL;

-- 3-3. 상태 복구 (APPLIED -> RECEIVED)
UPDATE transaction_drafts d
SET status = 'RECEIVED',
    updated_at = NOW()
FROM (
  SELECT d2.id
  FROM transaction_drafts d2
  LEFT JOIN transactions t2 ON t2.draft_id = d2.id
  WHERE d2.status = 'APPLIED'
    AND t2.id IS NULL
) target
WHERE d.id = target.id;

-- 검증 후 COMMIT / 문제 시 ROLLBACK
-- COMMIT;
-- ROLLBACK;
```

## 4) 검증 SQL
```sql
-- 복구 후 잔여 이상건 0 확인
SELECT COUNT(*) AS remaining_anomalies
FROM transaction_drafts d
LEFT JOIN transactions t ON t.draft_id = d.id
WHERE d.status = 'APPLIED'
  AND t.id IS NULL;

-- 이번 작업으로 RECEIVED로 바뀐 건수 확인
SELECT COUNT(*) AS reverted_count
FROM transaction_drafts d
JOIN backup_transaction_drafts_recovery_20260405 b ON b.id = d.id
WHERE d.status = 'RECEIVED';
```

## 롤백 방법
```sql
BEGIN;

UPDATE transaction_drafts d
SET status = b.status,
    updated_at = NOW()
FROM backup_transaction_drafts_recovery_20260405 b
WHERE d.id = b.id;

COMMIT;
```
