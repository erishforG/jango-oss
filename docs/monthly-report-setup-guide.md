# 월간 리포트 운영 세팅 가이드

## 1. GCP 환경변수 설정

Cloud Run 서비스(jango-api)에 아래 환경변수 추가:

```bash
# 필수
INTERNAL_JOBS_SECRET=<랜덤 시크릿 생성: openssl rand -hex 32>
INTERNAL_JOBS_ALLOWLIST=  # 비워두면 IP 체크 스킵 (Cloud Scheduler는 고정 IP 없음)

# 선택 (기본값 사용 가능)
MONTHLY_REPORT_ADMIN_ONLY=true          # true=관리자만, false=전체 유저
MONTHLY_REPORT_EMAIL_ENABLED=true       # 이메일 발송 활성화
MONTHLY_REPORT_RESEND_MAX_BATCH_SIZE=100
MONTHLY_REPORT_RESEND_MIN_INTERVAL_SECONDS=30
```

### 설정 방법 (gcloud CLI)
```bash
gcloud run services update jango-api \
  --region us-central1 \
  --update-env-vars "INTERNAL_JOBS_SECRET=$(openssl rand -hex 32)"
```

## 2. 배포 (Flyway 마이그레이션 자동)

develop → main 머지 시 자동 배포. V28~V31 마이그레이션이 자동 실행됨.
별도 DB 작업 불필요.

## 3. Cloud Scheduler 등록

### 3-1. 월간 리포트 생성 (매월 1일 09:00 KST)
```bash
gcloud scheduler jobs create http monthly-report-generate \
  --location us-central1 \
  --schedule "0 0 1 * *" \
  --time-zone "Asia/Seoul" \
  --uri "https://<SERVICE_URL>/api/internal/jobs/monthly-report/generate" \
  --http-method POST \
  --headers "X-Internal-Secret=<INTERNAL_JOBS_SECRET>,Content-Type=application/json" \
  --message-body '{}' \
  --attempt-deadline 300s
```
> `{}` = 전체 유저 대상, 전월 자동 계산

### 3-2. 월간 리포트 발송 (매월 1일 10:00 KST)
```bash
gcloud scheduler jobs create http monthly-report-dispatch \
  --location us-central1 \
  --schedule "0 1 1 * *" \
  --time-zone "Asia/Seoul" \
  --uri "https://<SERVICE_URL>/api/internal/jobs/monthly-report/dispatch" \
  --http-method POST \
  --headers "X-Internal-Secret=<INTERNAL_JOBS_SECRET>,Content-Type=application/json" \
  --message-body '{}' \
  --attempt-deadline 300s
```

## 4. 테스트 검증

### 관리자 웹 UI
- `/admin` 페이지 → **📊 월간 리포트 관리** 섹션
- 리포트 목록 조회, 배송 상태 필터, 실패 건 재발송 가능
- 🧪 테스트 발송 버튼으로 본인 계정 테스트

### API로 직접 테스트
```bash
# 본인 계정 테스트 발송
curl -X POST https://<SERVICE_URL>/api/admin/monthly-report/test-send \
  -H "X-Admin-Secret: <ADMIN_SECRET>"

# 특정 유저 리포트 생성
curl -X POST https://<SERVICE_URL>/api/internal/jobs/monthly-report/generate \
  -H "X-Internal-Secret: <INTERNAL_JOBS_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{"userId": 1, "periodYm": "2026-02"}'
```

## 5. 체크리스트

- [ ] `INTERNAL_JOBS_SECRET` 환경변수 설정
- [ ] develop → main 머지 & 배포
- [ ] Cloud Scheduler: generate job 등록
- [ ] Cloud Scheduler: dispatch job 등록  
- [ ] `/admin`에서 월간 리포트 섹션 확인
- [ ] 테스트 발송으로 이메일 수신 확인
- [ ] `MONTHLY_REPORT_ADMIN_ONLY=false`로 전환 (전체 오픈 시)
