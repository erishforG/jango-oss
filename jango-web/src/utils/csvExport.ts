/**
 * 간단 CSV 직렬화 + 브라우저 다운로드 유틸 (회계 리포트 → CSV 다운로드용).
 *
 * Reports 페이지(자산부채/비용수익/자금변동/신용카드)가 표시 중인 데이터를
 * 그대로 CSV 로 내보낸다. 별도 API 라운드트립 없이 클라이언트 메모리에서
 * 생성 → Blob → 다운로드 트리거.
 */

export type CsvCell = string | number | null | undefined;

/**
 * 값 1개를 RFC 4180 호환으로 인코딩.
 * - 쉼표/줄바꿈/따옴표 포함 시 큰따옴표로 감싸고 내부 따옴표는 이중화.
 */
export function csvEscape(value: CsvCell): string {
  if (value == null) return '';
  const s = String(value);
  if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * 2D 배열을 CSV 문자열로.
 */
export function toCsv(rows: CsvCell[][]): string {
  return rows.map((row) => row.map(csvEscape).join(',')).join('\n');
}

/**
 * CSV 다운로드를 트리거.
 * 한글 Excel 호환을 위해 UTF-8 BOM 을 앞에 붙인다.
 */
export function downloadCsv(filename: string, rows: CsvCell[][]): void {
  const csv = toCsv(rows);
  const BOM = '﻿';
  const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * YYYY-MM-DD 형식의 오늘 날짜 — 파일명 suffix 용.
 */
export function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
