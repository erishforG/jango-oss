# Monthly Report Job APIs (#357)

## Internal Job Endpoints
- `POST /api/internal/jobs/monthly-report/generate`
  - Header: `X-Internal-Secret`
  - Optional: `X-Idempotency-Key`
  - Body: `{ "userId": 1?, "periodYm": "YYYY-MM"?, "limit": 1000? }`
- `POST /api/internal/jobs/monthly-report/send`
  - Header: `X-Internal-Secret`
  - Optional: `X-Idempotency-Key`

## Admin Endpoints
- `GET /api/admin/monthly-report/deliveries`
- `POST /api/admin/monthly-report/deliveries/{id}/resend`
- `POST /api/admin/monthly-report/deliveries/resend-failed`
- `POST /api/admin/monthly-report/test-send`

All admin endpoints require `X-Admin-Secret`.

## Guard enforcement
- Internal jobs use `InternalJobAuthFilter`
  - secret: `INTERNAL_JOBS_SECRET`
  - optional IP allowlist: `INTERNAL_JOBS_ALLOWLIST` (comma-separated)
- Admin endpoints use existing `AdminAuthFilter` (`ADMIN_SECRET`)

## Idempotency + audit
- Idempotency table: `job_request_idempotency`
- Supported via `X-Idempotency-Key`
- Audit entries are written to `card_sms_ai_audit_logs` with action names:
  - `MONTHLY_REPORT_GENERATE`
  - `MONTHLY_REPORT_SEND`
  - `MONTHLY_REPORT_DELIVERY_RESEND`
  - `MONTHLY_REPORT_DELIVERY_RESEND_FAILED`
  - `MONTHLY_REPORT_TEST_SEND`
