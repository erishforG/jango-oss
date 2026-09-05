# Performance List Patterns (Jango)

이 문서는 거래/대시보드/캘린더/보고서 API에서 반복 적용할 성능 패턴을 정리한다.

## 1) Count-less Slice 기본
- 기본 리스트 API는 `count(*)`를 매번 계산하지 않는다.
- `size + 1`로 조회 후 `hasNext`만 내려준다.
- 총 건수(`totalCount`)가 꼭 필요한 화면에서만 별도 API/지연 계산한다.

## 2) Cursor(키셋) 페이지네이션 우선
- 정렬 키가 명확할 때 (`date desc, id desc`) `OFFSET` 대신 커서 사용.
- 다음 페이지 조건 예:
  - `date < :cursorDate OR (date = :cursorDate AND id < :cursorId)`

## 3) 무필터 Fast Path 분기
- 필터가 비어있는 기본 조회는 전용 단순 쿼리로 우회.
- 공용 검색 쿼리(OR/EXISTS 다수)를 기본 경로로 타지 않게 한다.

## 4) ID-First 2단계 조회
- 1단계: ID 목록만 slice/page 조회
- 2단계: 해당 ID들의 상세/하위 엔트리를 배치 조회
- 이때 정렬 안정성(`date,id`)을 유지한다.

## 5) 엔티티 하이드레이션 최소화 (Projection)
- 목록/리포트 API는 JPA 엔티티 fetch-join 대신 projection DTO를 우선 사용.
- 필요한 컬럼만 select해서 매핑 비용과 메모리 사용을 줄인다.

## 6) Stage 기반 성능 로그 표준화
모든 핵심 리스트/리포트 API에 다음 로그를 남긴다.
- `path` (FAST_PATH/HEAVY_PATH/FALLBACK)
- `idsMs`, `fetchMs`, `mapMs`, `totalMs`
- 핵심 필터 사용 여부

예시:
```
[transactions][perf] path=FAST_PATH idsMs=180 txFetchMs=530 mapMs=180 totalMs=900
```

## 7) 적용 체크리스트
- [ ] countQuery가 기본 경로에 남아있는가?
- [ ] 기본 조회가 heavy search query를 타는가?
- [ ] 엔티티 매핑(mapMs)이 30% 이상 차지하는가?
- [ ] `hasNext + cursor`로 대체 가능한가?
- [ ] projection으로 변경 시 응답 스키마 호환성은 유지되는가?

## 8) 이번 적용 요약
- Transactions
  - Cursor + count-less slice 적용
  - 무필터 fast path 추가
  - Entry 매핑 projection 전환
- Dashboard
  - 전체 보고서 구성 호출 대신 집계 projection으로 경량화
- Cash Flow Report
  - Entry 엔티티 로딩 대신 cash-flow projection row로 계산

---
관련 PR: #677, #678, #679, #680, #681
