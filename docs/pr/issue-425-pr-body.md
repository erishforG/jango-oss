## Summary
- Add multi-ledger collaboration foundation schema:
  - `ledger_memberships`
  - `ledger_invites`
  - `ledger_audit_logs`
- Extend `ledgers` with explicit ownership (`owner_user_id`) while keeping existing `user_id` for backward compatibility.
- Extend `users` with `default_ledger_id`.
- Extend `transactions` with collaborative/idempotency metadata + indexes.
- Backfill default ledger, owner memberships, and transaction author metadata for existing data.

## Migrations
1. `V32__multi_ledger_schema_foundation.sql`
   - DDL only (new columns/tables/indexes)
   - Keeps old paths working (`ledgers.user_id` untouched)
2. `V33__backfill_default_ledger_and_memberships.sql`
   - Data backfill
   - Adds `NOT NULL` on `ledgers.owner_user_id` after fill

## Rollback Strategy
- **Schema rollback (emergency, pre-traffic switch):**
  - Drop newly created tables in reverse dependency order:
    1) `ledger_audit_logs`
    2) `ledger_invites`
    3) `ledger_memberships`
  - Drop added transaction indexes, then columns:
    - `external_ref`, `client_request_id`, `last_modified_by_user_id`, `created_by_user_id`
  - Drop `users.default_ledger_id` index/fk/column
  - Drop `ledgers.owner_user_id` index/fk/column
- **Data rollback:**
  - Backfilled rows are additive and non-destructive.
  - If needed, delete only auto-generated ledgers by description/name marker (`자동 생성된 기본 장부`) after confirming no dependent rows.

## Regression / Compatibility Impact
- Backward compatible for existing services:
  - Legacy `ledgers.user_id` is preserved.
  - Existing ledger/account/transaction APIs continue to function.
- New uniqueness on `transactions(ledger_id, client_request_id)` only applies when `client_request_id` is set.
- Added indexes are read-path safe and should not alter query semantics.

## Validation
- Run `docs/db/issue-425-validation.sql`.
- Key checks:
  - No users without `default_ledger_id`
  - No ledgers without owner or owner membership
  - No duplicated membership pairs
  - No transactions with missing `created_by_user_id`
