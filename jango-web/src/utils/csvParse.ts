/**
 * 경량 RFC 4180 CSV 파서 — CSV 가져오기 미리보기 전용.
 *
 * 기능:
 * - UTF-8 BOM 제거
 * - 큰따옴표 감싸기, 이중 따옴표 이스케이프 처리
 * - 헤더 + 첫 N개 행 파싱
 * - 필수 컬럼 존재 여부 검증 + 경고 메시지 생성
 *
 * 주의: 대용량 파일 전체 파싱이 아닌 미리보기용으로, maxRows 이후는 읽지 않는다.
 */

export interface CsvPreviewResult {
  /** 헤더 컬럼 목록 */
  headers: string[];
  /** 미리보기 행 (헤더 제외, 최대 maxRows) */
  rows: string[][];
  /** 총 데이터 행 수 (헤더 제외) — 실제 파일 라인 수 기반 추정 */
  estimatedTotal: number;
  /** 필수 컬럼 감지 결과 */
  detectedColumns: DetectedColumns;
  /** 유효성 경고 메시지 목록 */
  warnings: string[];
  /** 가져오기를 진행해도 되는지 여부 */
  canImport: boolean;
}

export interface DetectedColumns {
  date: boolean;
  amount: boolean;
  memo: boolean;
  leftAccount: boolean;
  rightAccount: boolean;
  isNewFormat: boolean;
}

/**
 * 사용자가 직접 지정한 컬럼 매핑.
 * 각 필드는 원본 CSV 헤더명이거나 '' (매핑 안 함).
 */
export interface ColumnMapping {
  date: string;
  amount: string;
  memo: string;
  leftAccount: string;
  rightAccount: string;
}

/**
 * 자동 감지 결과로 초기 ColumnMapping을 생성.
 * 감지된 컬럼이 있으면 해당 헤더명을 미리 채워준다.
 */
export function defaultMappingFromDetected(
  headers: string[],
  _detected: DetectedColumns,
): ColumnMapping {
  const h = headers.map((s) => s.trim());
  const find = (matchers: string[]) =>
    h.find((col) => matchers.some((m) => col.toLowerCase().includes(m.toLowerCase()))) ?? '';
  return {
    date: find(['날짜', 'date']),
    amount: find(['금액', 'amount']),
    memo: find(['메모', '적요', 'memo']),
    leftAccount: find(['좌변', '차변', 'left']),
    rightAccount: find(['우변', '대변', 'right']),
  };
}

/**
 * 사용자 매핑에 따라 CSV 헤더를 표준 열 이름으로 교체하여 반환.
 * 데이터 행은 그대로 두고 첫 줄(헤더)만 변경한다.
 *
 * 표준 이름: 날짜 / 금액 / 메모 / 좌변계정 / 우변계정
 */
export function remapCsvColumns(text: string, mapping: ColumnMapping): string {
  const cleaned = stripBom(text);
  const lines = cleaned.split(/\r?\n/);
  if (!lines.length) return text;

  const origHeaders = parseCsvLine(lines[0]).map((h) => h.trim().replace(/^"|"$/g, ''));

  // 원본 헤더명 → 표준 헤더명
  const rename: Record<string, string> = {};
  if (mapping.date) rename[mapping.date] = '날짜';
  if (mapping.amount) rename[mapping.amount] = '금액';
  if (mapping.memo) rename[mapping.memo] = '메모';
  if (mapping.leftAccount) rename[mapping.leftAccount] = '좌변계정';
  if (mapping.rightAccount) rename[mapping.rightAccount] = '우변계정';

  const newHeaders = origHeaders.map((h) => rename[h] ?? h);
  // 재조합: 쉼표 포함 값은 따옴표로 감싸기
  lines[0] = newHeaders.map((h) => (h.includes(',') ? `"${h}"` : h)).join(',');
  return lines.join('\n');
}

const REQUIRED_COLS = ['date', 'amount'] as const;

/** 텍스트 파일에서 UTF-8 BOM 제거 */
function stripBom(text: string): string {
  return text.startsWith('\uFEFF') ? text.slice(1) : text;
}

/** CSV 한 줄을 셀 배열로 파싱 (RFC 4180) */
export function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = '';
  let inQuote = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuote) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuote = false;
        }
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') {
        inQuote = true;
      } else if (ch === ',') {
        cells.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
  }
  cells.push(cur);
  return cells;
}

/** 헤더 셀에서 컬럼 종류 감지 */
function detectColumns(headers: string[]): DetectedColumns {
  const h = headers.map((s) => s.trim().toLowerCase());

  const date = h.some((s) => s.includes('날짜') || s.includes('date'));
  const amount = h.some((s) => s.includes('금액') || s.includes('amount'));
  const memo = h.some((s) => s.includes('메모') || s.includes('적요') || s.includes('memo'));

  const leftAccount = h.some(
    (s) => s.includes('왼쪽') || s.includes('좌변') || s.includes('차변') || s.includes('left'),
  );
  const rightAccount = h.some(
    (s) => s.includes('오른쪽') || s.includes('우변') || s.includes('대변') || s.includes('right'),
  );

  // 새 형식: 왼쪽/오른쪽 (계정유형 포함) vs 구 형식: 좌변/우변 계정명
  const isNewFormat = h.some((s) => s.includes('왼쪽') || s.includes('오른쪽'));

  return { date, amount, memo, leftAccount, rightAccount, isNewFormat };
}

/** 경고 메시지 생성 */
function buildWarnings(detected: DetectedColumns, totalRows: number): string[] {
  const warnings: string[] = [];

  if (!detected.date) warnings.push('날짜 컬럼을 찾을 수 없습니다 (날짜 또는 date 컬럼 필요)');
  if (!detected.amount) warnings.push('금액 컬럼을 찾을 수 없습니다 (금액 또는 amount 컬럼 필요)');
  if (!detected.leftAccount && !detected.rightAccount)
    warnings.push(
      '계정과목 컬럼이 없습니다 (좌변/차변/left 또는 우변/대변/right 컬럼을 추가하면 계정 자동 매핑됩니다)',
    );
  if (totalRows === 0) warnings.push('데이터 행이 없습니다');

  return warnings;
}

/**
 * CSV 텍스트를 파싱하여 미리보기 결과를 반환.
 *
 * @param text  CSV 파일 텍스트 (UTF-8, BOM 포함 가능)
 * @param maxRows  미리보기 행 수 (기본 5)
 */
export function parseCsvPreview(text: string, maxRows = 5): CsvPreviewResult {
  const cleaned = stripBom(text);
  const lines = cleaned.split(/\r?\n/).filter((l) => l.trim().length > 0);

  if (lines.length === 0) {
    return {
      headers: [],
      rows: [],
      estimatedTotal: 0,
      detectedColumns: {
        date: false,
        amount: false,
        memo: false,
        leftAccount: false,
        rightAccount: false,
        isNewFormat: false,
      },
      warnings: ['파일이 비어있습니다'],
      canImport: false,
    };
  }

  const headers = parseCsvLine(lines[0]).map((h) => h.trim().replace(/^"|"$/g, ''));
  const dataLines = lines.slice(1);
  const estimatedTotal = dataLines.length;

  const previewLines = dataLines.slice(0, maxRows);
  const rows = previewLines.map((line) => parseCsvLine(line));

  const detectedColumns = detectColumns(headers);
  const warnings = buildWarnings(detectedColumns, estimatedTotal);

  const canImport = REQUIRED_COLS.every(
    (col) => detectedColumns[col as keyof Pick<DetectedColumns, 'date' | 'amount'>],
  );

  return { headers, rows, estimatedTotal, detectedColumns, warnings, canImport };
}

/** FileReader 를 이용해 File 객체를 텍스트로 읽어 미리보기 생성 */
export function readCsvPreview(file: File, maxRows = 5): Promise<CsvPreviewResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      resolve(parseCsvPreview(text, maxRows));
    };
    reader.onerror = () => reject(new Error('파일을 읽을 수 없습니다'));
    // UTF-8 먼저 시도; 서버 import는 charset 자동 감지하므로 미리보기에서 BOM 있는 경우도 처리됨
    reader.readAsText(file, 'UTF-8');
  });
}
