/**
 * csvParse 유닛 테스트
 * - parseCsvLine: RFC 4180 파싱
 * - parseCsvPreview: 헤더 감지, 컬럼 감지, 경고 생성, canImport 판정
 */

import { describe, it, expect } from 'vitest';
import {
  parseCsvLine,
  parseCsvPreview,
  defaultMappingFromDetected,
  remapCsvColumns,
  type DetectedColumns,
} from './csvParse';

// ---------------------------------------------------------------------------
// parseCsvLine
// ---------------------------------------------------------------------------
describe('parseCsvLine', () => {
  it('기본 쉼표 구분 파싱', () => {
    expect(parseCsvLine('a,b,c')).toEqual(['a', 'b', 'c']);
  });

  it('큰따옴표 감싸기', () => {
    expect(parseCsvLine('"hello world",b,c')).toEqual(['hello world', 'b', 'c']);
  });

  it('큰따옴표 안 이중 따옴표 이스케이프', () => {
    expect(parseCsvLine('"say ""hi""",b')).toEqual(['say "hi"', 'b']);
  });

  it('쉼표 포함 셀', () => {
    expect(parseCsvLine('"a,b",c')).toEqual(['a,b', 'c']);
  });

  it('빈 셀 처리', () => {
    expect(parseCsvLine('a,,c')).toEqual(['a', '', 'c']);
  });
});

// ---------------------------------------------------------------------------
// parseCsvPreview — 필수 컬럼 감지
// ---------------------------------------------------------------------------
describe('parseCsvPreview — 필수 컬럼 감지', () => {
  it('날짜/금액 컬럼 모두 있으면 canImport=true', () => {
    const csv = '날짜,금액,메모\n2024-01-01,10000,식비';
    const result = parseCsvPreview(csv);
    expect(result.canImport).toBe(true);
    expect(result.detectedColumns.date).toBe(true);
    expect(result.detectedColumns.amount).toBe(true);
    // 날짜/금액 필수 컬럼 관련 차단 경고는 없어야 함 (계정과목 안내는 informational)
    expect(result.warnings.filter((w) => w.includes('날짜') || w.includes('금액'))).toHaveLength(0);
  });

  it('영문 컬럼(date/amount) 인식', () => {
    const csv = 'date,amount,memo\n2024-01-01,5000,coffee';
    const result = parseCsvPreview(csv);
    expect(result.canImport).toBe(true);
    expect(result.detectedColumns.date).toBe(true);
    expect(result.detectedColumns.amount).toBe(true);
  });

  it('날짜 컬럼 누락 시 canImport=false + 경고', () => {
    const csv = '금액,메모\n10000,식비';
    const result = parseCsvPreview(csv);
    expect(result.canImport).toBe(false);
    expect(result.warnings.some((w) => w.includes('날짜'))).toBe(true);
  });

  it('금액 컬럼 누락 시 canImport=false + 경고', () => {
    const csv = '날짜,메모\n2024-01-01,식비';
    const result = parseCsvPreview(csv);
    expect(result.canImport).toBe(false);
    expect(result.warnings.some((w) => w.includes('금액'))).toBe(true);
  });

  it('둘 다 누락 시 canImport=false + 경고 2개 이상', () => {
    const csv = '메모\n식비';
    const result = parseCsvPreview(csv);
    expect(result.canImport).toBe(false);
    expect(result.warnings.length).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// parseCsvPreview — 미리보기 행
// ---------------------------------------------------------------------------
describe('parseCsvPreview — 미리보기 행', () => {
  const buildCsv = (rows: number) => {
    const header = '날짜,금액,메모';
    const lines = Array.from({ length: rows }, (_, i) => `2024-01-${String(i + 1).padStart(2, '0')},${(i + 1) * 1000},item${i + 1}`);
    return [header, ...lines].join('\n');
  };

  it('maxRows=5 기본값 — 5행 이하 반환', () => {
    const csv = buildCsv(10);
    const result = parseCsvPreview(csv);
    expect(result.rows).toHaveLength(5);
    expect(result.estimatedTotal).toBe(10);
  });

  it('데이터가 maxRows보다 적으면 전부 반환', () => {
    const csv = buildCsv(3);
    const result = parseCsvPreview(csv);
    expect(result.rows).toHaveLength(3);
  });

  it('maxRows 커스텀 값 적용', () => {
    const csv = buildCsv(10);
    const result = parseCsvPreview(csv, 3);
    expect(result.rows).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// parseCsvPreview — BOM 처리
// ---------------------------------------------------------------------------
describe('parseCsvPreview — BOM 처리', () => {
  it('UTF-8 BOM 제거 후 정상 파싱', () => {
    const bom = '\uFEFF';
    const csv = `${bom}날짜,금액\n2024-01-01,1000`;
    const result = parseCsvPreview(csv);
    expect(result.headers[0]).toBe('날짜');
    expect(result.canImport).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// parseCsvPreview — 빈 파일
// ---------------------------------------------------------------------------
describe('parseCsvPreview — 빈 파일', () => {
  it('빈 문자열 → canImport=false + 경고', () => {
    const result = parseCsvPreview('');
    expect(result.canImport).toBe(false);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('헤더만 있고 데이터 없음 → estimatedTotal=0 + 경고', () => {
    const result = parseCsvPreview('날짜,금액');
    expect(result.estimatedTotal).toBe(0);
    expect(result.warnings.some((w) => w.includes('데이터 행'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// parseCsvPreview — 계정 컬럼 감지
// ---------------------------------------------------------------------------
describe('parseCsvPreview — 계정 컬럼 감지', () => {
  it('좌변/우변 컬럼 감지', () => {
    const csv = '날짜,금액,좌변계정,우변계정\n2024-01-01,5000,현금,수입';
    const result = parseCsvPreview(csv);
    expect(result.detectedColumns.leftAccount).toBe(true);
    expect(result.detectedColumns.rightAccount).toBe(true);
    expect(result.detectedColumns.isNewFormat).toBe(false);
  });

  it('왼쪽/오른쪽 컬럼 → 새 형식으로 감지', () => {
    const csv = '날짜,금액,왼쪽유형,왼쪽계정,오른쪽유형,오른쪽계정\n2024-01-01,5000,자산,현금,수입,급여';
    const result = parseCsvPreview(csv);
    expect(result.detectedColumns.isNewFormat).toBe(true);
  });

  it('메모/적요 컬럼 감지', () => {
    const csv = '날짜,금액,적요\n2024-01-01,5000,편의점';
    const result = parseCsvPreview(csv);
    expect(result.detectedColumns.memo).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// defaultMappingFromDetected
// ---------------------------------------------------------------------------
describe('defaultMappingFromDetected', () => {
  const emptyDetected: DetectedColumns = {
    date: false, amount: false, memo: false,
    leftAccount: false, rightAccount: false, isNewFormat: false,
  };

  it('구분자 없는 비표준 헤더 — 날짜 매핑 안 됨, 금액 부분일치로 매핑됨', () => {
    // 거래일자: 날짜/date 미포함 → 매핑 안 됨
    // 거래금액: 금액 포함 → 정상 매핑
    const result = defaultMappingFromDetected(['거래일자', '거래금액', '내용'], emptyDetected);
    expect(result.date).toBe('');
    expect(result.amount).toBe('거래금액');
  });

  it('표준 키워드 포함 헤더 매핑', () => {
    const result = defaultMappingFromDetected(['날짜', '금액', '메모'], emptyDetected);
    expect(result.date).toBe('날짜');
    expect(result.amount).toBe('금액');
    expect(result.memo).toBe('메모');
  });

  it('영문 헤더 매핑', () => {
    const result = defaultMappingFromDetected(['date', 'amount', 'memo'], emptyDetected);
    expect(result.date).toBe('date');
    expect(result.amount).toBe('amount');
  });
});

// ---------------------------------------------------------------------------
// remapCsvColumns
// ---------------------------------------------------------------------------
describe('remapCsvColumns', () => {
  it('비표준 헤더를 표준 헤더로 교체', () => {
    const csv = '거래일자,거래금액,비고\n2024-01-01,5000,식비';
    const mapping = { date: '거래일자', amount: '거래금액', memo: '비고', leftAccount: '', rightAccount: '' };
    const result = remapCsvColumns(csv, mapping);
    const [header, dataRow] = result.split('\n');
    expect(header).toBe('날짜,금액,메모');
    expect(dataRow).toBe('2024-01-01,5000,식비'); // 데이터 행 불변
  });

  it('매핑되지 않은 컬럼은 원본 유지', () => {
    const csv = '날짜,금액,커스텀필드\n2024-01-01,1000,foo';
    const mapping = { date: '날짜', amount: '금액', memo: '', leftAccount: '', rightAccount: '' };
    const result = remapCsvColumns(csv, mapping);
    expect(result.split('\n')[0]).toBe('날짜,금액,커스텀필드');
  });

  it('BOM 포함 파일도 정상 처리', () => {
    const bom = '\uFEFF';
    const csv = `${bom}거래일,금액\n2024-01-01,9000`;
    const mapping = { date: '거래일', amount: '금액', memo: '', leftAccount: '', rightAccount: '' };
    const result = remapCsvColumns(csv, mapping);
    expect(result.split('\n')[0]).toBe('날짜,금액');
  });

  it('매핑이 빈 문자열이면 헤더 변경 없음', () => {
    const csv = '날짜,금액\n2024-01-01,3000';
    const mapping = { date: '', amount: '', memo: '', leftAccount: '', rightAccount: '' };
    const result = remapCsvColumns(csv, mapping);
    expect(result.split('\n')[0]).toBe('날짜,금액');
  });

  it('Windows CRLF(\\r\\n) 라인엔딩 CSV 정상 리맵', () => {
    const csv = '일자,지출\r\n2024-01-01,5000\r\n2024-01-02,3000';
    const mapping = { date: '일자', amount: '지출', memo: '', leftAccount: '', rightAccount: '' };
    const result = remapCsvColumns(csv, mapping);
    // remapCsvColumns는 split(/\r?\n/) 후 \n으로 재조합하므로 CRLF를 \n으로 정규화
    expect(result.split('\n')[0]).toBe('날짜,금액');
    // 데이터행은 \r 제거된 상태로 유지됨
    expect(result.split('\n')[1]).toBe('2024-01-01,5000');
    expect(result.split('\n')[2]).toBe('2024-01-02,3000');
  });
});

// ---------------------------------------------------------------------------
// parseCsvPreview — 트레일링 빈 라인 처리
// ---------------------------------------------------------------------------
describe('parseCsvPreview — 트레일링 빈 라인', () => {
  it('마지막 빈 라인 제외하고 estimatedTotal 정확 산정', () => {
    // 3 데이터 행 + 2 빈 라인 종료
    const csv = '날짜,금액\n2024-01-01,1000\n2024-01-02,2000\n2024-01-03,3000\n\n';
    const result = parseCsvPreview(csv);
    expect(result.estimatedTotal).toBe(3);
    expect(result.canImport).toBe(true);
  });

  it('데이터 행이 1000개이면 estimatedTotal=1000', () => {
    const header = '날짜,금액';
    const rows = Array.from({ length: 1000 }, (_, i) => `2024-01-01,${i + 1}`);
    const csv = [header, ...rows].join('\n');
    const result = parseCsvPreview(csv);
    expect(result.estimatedTotal).toBe(1000);
    expect(result.rows).toHaveLength(5); // maxRows 기본값
  });
});
