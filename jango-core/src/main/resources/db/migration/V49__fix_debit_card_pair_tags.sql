-- V49: Add debit-card-pair tags to settlement transactions created by V48
-- 최적화: 루프 제거, 단일 UPDATE문으로 변경

-- 1) 정산 거래 memo 수정
UPDATE transactions
SET memo = '체크카드 결제대금 자동 정산'
WHERE source = 'migration_v48'
  AND memo = '체크카드 연결 통장 자동 정산';

-- 2) 정산↔원본 매칭 후 양쪽 태그 일괄 추가
-- 원본 거래 태그 추가
UPDATE transactions t_orig
SET tags = ARRAY['debit-card-pair', 'pair:dc:' || t_orig.id::text]
FROM entries e_orig_cr, accounts a, entries e_settle_dr, transactions t_settle
WHERE e_orig_cr.transaction_id = t_orig.id
  AND e_orig_cr.type = 'CR'
  AND a.id = e_orig_cr.account_id
  AND a.subtype = 'DEBIT_CARD'
  AND e_settle_dr.account_id = a.id
  AND e_settle_dr.type = 'DR'
  AND e_settle_dr.amount = e_orig_cr.amount
  AND t_settle.id = e_settle_dr.transaction_id
  AND t_settle.source = 'migration_v48'
  AND t_settle.date = t_orig.date
  AND t_orig.id != t_settle.id
  AND (t_orig.tags IS NULL OR NOT ('debit-card-pair' = ANY(t_orig.tags)));

-- 정산 거래 태그 추가
UPDATE transactions t_settle
SET tags = ARRAY['debit-card-pair', 'pair:dc:' || t_orig.id::text]
FROM entries e_settle_dr, accounts a, entries e_orig_cr, transactions t_orig
WHERE e_settle_dr.transaction_id = t_settle.id
  AND e_settle_dr.type = 'DR'
  AND a.id = e_settle_dr.account_id
  AND a.subtype = 'DEBIT_CARD'
  AND e_orig_cr.account_id = a.id
  AND e_orig_cr.type = 'CR'
  AND e_orig_cr.amount = e_settle_dr.amount
  AND t_orig.id = e_orig_cr.transaction_id
  AND t_orig.date = t_settle.date
  AND t_orig.id != t_settle.id
  AND t_settle.source = 'migration_v48'
  AND (t_settle.tags IS NULL OR NOT ('debit-card-pair' = ANY(t_settle.tags)));
