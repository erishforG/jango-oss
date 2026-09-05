-- V55: 어드민 토글 가능한 feature flag 시스템
--
-- 단순 key-value 토글. 기본값은 false (safe-default). 어드민이 enabled=true 로
-- 켜기 전까지 모든 flag 는 비활성. 월간 리포트는 v1.0 (AI-Powered) 까지 OFF.
-- Issue #795.

CREATE TABLE feature_flags (
    name        VARCHAR(64)  PRIMARY KEY,
    enabled     BOOLEAN      NOT NULL DEFAULT FALSE,
    description VARCHAR(500),
    updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by  VARCHAR(64)
);

-- 초기 시드: v1.0 까지 월간 리포트 OFF 상태로 시작
INSERT INTO feature_flags (name, enabled, description, updated_by) VALUES
    ('monthly_report_enabled', FALSE,
     '월간 리포트 자동 생성 + 발송 활성화. v1.0 (AI-Powered Bookkeeping) 출시 후 ON 예정.',
     'system:V55');
