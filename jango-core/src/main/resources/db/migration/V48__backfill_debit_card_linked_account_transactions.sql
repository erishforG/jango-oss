-- V48: Backfill linked-account settlement transactions for DEBIT_CARD accounts
-- Issue #574: 체크카드 거래에 연결 통장 엔트리가 누락된 기존 데이터 보정
--
-- 기존: TX1(DR 지출 / CR 체크카드)
-- 추가: TX2(DR 체크카드 / CR 통장) — 같은 날짜, 같은 금액

DO $$
DECLARE
    rec RECORD;
    new_tx_id BIGINT;
BEGIN
    FOR rec IN
        SELECT
            t.id AS tx_id,
            t.ledger_id,
            t.date,
            t.created_by_user_id,
            e.amount,
            e.currency,
            e.base_amount,
            a.id AS debit_card_account_id,
            a.linked_account_id
        FROM entries e
        JOIN transactions t ON t.id = e.transaction_id
        JOIN accounts a ON a.id = e.account_id
        WHERE a.subtype = 'DEBIT_CARD'
          AND a.linked_account_id IS NOT NULL
          AND e.type = 'CR'
          -- Skip if already has a settlement tx (idempotent)
          AND NOT EXISTS (
              SELECT 1 FROM transactions t2
              JOIN entries e_dr ON e_dr.transaction_id = t2.id
                  AND e_dr.account_id = a.id AND e_dr.type = 'DR'
                  AND e_dr.amount = e.amount
              JOIN entries e_cr ON e_cr.transaction_id = t2.id
                  AND e_cr.account_id = a.linked_account_id AND e_cr.type = 'CR'
              WHERE t2.ledger_id = t.ledger_id
                AND t2.date = t.date
                AND t2.source = 'migration_v48'
          )
    LOOP
        INSERT INTO transactions (ledger_id, date, description, memo, source, created_by_user_id, created_at, updated_at)
        VALUES (rec.ledger_id, rec.date, '자동이체', '체크카드 연결 통장 자동 정산', 'migration_v48', rec.created_by_user_id, NOW(), NOW())
        RETURNING id INTO new_tx_id;

        INSERT INTO entries (transaction_id, account_id, type, amount, currency, base_amount, created_at, updated_at)
        VALUES (new_tx_id, rec.debit_card_account_id, 'DR', rec.amount, rec.currency, rec.base_amount, NOW(), NOW());

        INSERT INTO entries (transaction_id, account_id, type, amount, currency, base_amount, created_at, updated_at)
        VALUES (new_tx_id, rec.linked_account_id, 'CR', rec.amount, rec.currency, rec.base_amount, NOW(), NOW());
    END LOOP;
END $$;
