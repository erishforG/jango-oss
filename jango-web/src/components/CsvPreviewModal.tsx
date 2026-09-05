/**
 * CSV 가져오기 미리보기 모달
 *
 * CSV 파일 선택 후 실제 업로드 전에 헤더·샘플 행·컬럼 감지 결과·경고를 보여준다.
 * 사용자가 "가져오기 시작" 또는 "취소"를 선택한다.
 */

import { AlertTriangle, Check, ChevronDown, ChevronUp, FileText, X, Upload } from 'lucide-react';
import { useState } from 'react';
import {
  defaultMappingFromDetected,
  type ColumnMapping,
  type CsvPreviewResult,
} from '../utils/csvParse';

interface CsvPreviewModalProps {
  filename: string;
  preview: CsvPreviewResult;
  /** 매핑이 적용된 경우 ColumnMapping을 전달, 기본 자동감지라면 null */
  onConfirm: (mapping: ColumnMapping | null) => void;
  onCancel: () => void;
}

const MAX_COL_WIDTH = 120; // px — 긴 셀 말줄임

/** 컴팩트 매핑 드롭다운 로우 */
function MappingRow({
  label,
  required,
  value,
  headers,
  onChange,
}: {
  label: string;
  required?: boolean;
  value: string;
  headers: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-20 shrink-0 text-text-secondary">
        {label}
        {required && <span className="text-expense ml-0.5">*</span>}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 px-2 py-1 rounded-lg border border-border bg-surface text-text-primary text-xs focus:outline-none focus:ring-1 focus:ring-primary/30"
      >
        <option value="">{required ? '열 선택하세요' : '선택 안 함'}</option>
        {headers.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function CsvPreviewModal({
  filename,
  preview,
  onConfirm,
  onCancel,
}: CsvPreviewModalProps) {
  const { headers, rows, estimatedTotal, detectedColumns, warnings, canImport } = preview;

  // 콘럼 매핑 상태 — 자동 감지 기반으로 초기화
  const [mapping, setMapping] = useState<ColumnMapping>(() =>
    defaultMappingFromDetected(headers, detectedColumns),
  );
  // 자동 감지가 안 된 필수 컴럼이 있으면 자동 전개
  const [showMapping, setShowMapping] = useState(!canImport);

  const setField = (field: keyof ColumnMapping) => (v: string) =>
    setMapping((prev) => ({ ...prev, [field]: v }));

  // 사용자 매핑 기준으로 canImport 재판정
  const mappingCanImport = Boolean(mapping.date && mapping.amount);
  // 실제 모달에서 가져오기 가능 여부
  const effectiveCanImport = canImport || mappingCanImport;

  // 매핑이 자동 감지와 다를 때 (=실제 주입할 횤트)
  const isMappingChanged =
    showMapping &&
    ((!detectedColumns.date && mapping.date) || (!detectedColumns.amount && mapping.amount));

  const hasWarnings = warnings.length > 0;
  const hasErrors = !effectiveCanImport;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
      onClick={onCancel}
    >
      <div
        className="bg-surface rounded-t-2xl sm:rounded-2xl border border-border w-full sm:max-w-2xl max-h-[90dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-primary" />
            <span className="text-sm font-semibold text-text-primary">CSV 가져오기 미리보기</span>
          </div>
          <button
            onClick={onCancel}
            className="p-1 rounded-lg hover:bg-surface-secondary transition text-text-tertiary hover:text-text-primary"
            aria-label="닫기"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* 파일 정보 */}
          <div className="flex items-center gap-2 text-xs text-text-secondary">
            <FileText size={12} />
            <span className="font-medium truncate">{filename}</span>
            <span className="text-text-tertiary">·</span>
            <span className="text-text-tertiary shrink-0">
              총 {estimatedTotal.toLocaleString()}행
            </span>
          </div>

          {/* 컬럼 감지 */}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-text-secondary">감지된 컬럼</p>
            <div className="flex flex-wrap gap-1.5">
              <ColumnBadge label="날짜" ok={detectedColumns.date} />
              <ColumnBadge label="금액" ok={detectedColumns.amount} />
              <ColumnBadge label="메모/적요" ok={detectedColumns.memo} optional />
              <ColumnBadge label="좌변 계정" ok={detectedColumns.leftAccount} optional />
              <ColumnBadge label="우변 계정" ok={detectedColumns.rightAccount} optional />
            </div>
            {detectedColumns.isNewFormat && (
              <p className="text-[10px] text-text-tertiary">
                ✦ 새 형식 (왼쪽/오른쪽 계정 유형 포함) 감지됨
              </p>
            )}
          </div>

          {/* 경고/오류 */}
          {hasWarnings && (
            <div
              className={`rounded-xl p-3 space-y-1 text-xs ${hasErrors ? 'bg-expense/10 text-expense' : 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400'}`}
            >
              {warnings.map((w, i) => (
                <p key={i} className="flex items-start gap-1.5">
                  <AlertTriangle size={11} className="shrink-0 mt-0.5" />
                  {w}
                </p>
              ))}
            </div>
          )}

          {/* 미리보기 테이블 */}
          {headers.length > 0 && rows.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-text-secondary">
                미리보기 (처음 {rows.length}행)
              </p>
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="bg-surface-secondary">
                      {headers.map((h, i) => (
                        <th
                          key={i}
                          className="px-2.5 py-2 text-left font-semibold text-text-secondary border-b border-border whitespace-nowrap"
                          style={{ maxWidth: MAX_COL_WIDTH }}
                        >
                          <span
                            className="block truncate"
                            style={{ maxWidth: MAX_COL_WIDTH }}
                            title={h}
                          >
                            {h}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, ri) => (
                      <tr
                        key={ri}
                        className="border-b border-border/50 last:border-b-0 hover:bg-surface-secondary/50"
                      >
                        {headers.map((_, ci) => (
                          <td
                            key={ci}
                            className="px-2.5 py-1.5 text-text-secondary"
                            style={{ maxWidth: MAX_COL_WIDTH }}
                          >
                            <span
                              className="block truncate"
                              style={{ maxWidth: MAX_COL_WIDTH }}
                              title={row[ci] ?? ''}
                            >
                              {row[ci] ?? ''}
                            </span>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {estimatedTotal > rows.length && (
                <p className="text-[10px] text-text-tertiary text-right">
                  +{(estimatedTotal - rows.length).toLocaleString()}행 더 있음
                </p>
              )}
            </div>
          )}

          {/* 컬럼 직접 지정 토글 */}
          <div className="border border-border rounded-xl overflow-hidden">
            <button
              onClick={() => setShowMapping((v) => !v)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs text-text-secondary hover:bg-surface-secondary transition"
            >
              <span className="font-medium">
                {showMapping ? '컬럼 매핑 접기' : '컬럼 직접 지정 (CSV 헤더가 다를 때)'}
              </span>
              {showMapping ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
            {showMapping && (
              <div className="px-3 pb-3 space-y-2 border-t border-border bg-surface-secondary/30">
                <p className="text-[10px] text-text-tertiary pt-2">
                  어느 열이 어떤 필드인지 지정하세요. 날짜와 금액은 필수입니다.
                </p>
                <MappingRow
                  label="날짜"
                  required
                  value={mapping.date}
                  headers={headers}
                  onChange={setField('date')}
                />
                <MappingRow
                  label="금액"
                  required
                  value={mapping.amount}
                  headers={headers}
                  onChange={setField('amount')}
                />
                <MappingRow
                  label="메모/적요"
                  value={mapping.memo}
                  headers={headers}
                  onChange={setField('memo')}
                />
                <MappingRow
                  label="좌변 계정"
                  value={mapping.leftAccount}
                  headers={headers}
                  onChange={setField('leftAccount')}
                />
                <MappingRow
                  label="우변 계정"
                  value={mapping.rightAccount}
                  headers={headers}
                  onChange={setField('rightAccount')}
                />
              </div>
            )}
          </div>
        </div>

        {/* 액션 버튼 */}
        <div className="px-5 pb-5 flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 text-sm border border-border rounded-xl hover:bg-surface-secondary transition text-text-secondary"
          >
            취소
          </button>
          <button
            onClick={() => onConfirm(isMappingChanged ? mapping : null)}
            disabled={hasErrors}
            className="flex-1 py-2.5 text-sm font-medium text-white bg-primary rounded-xl hover:bg-primary-dark transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
          >
            <Upload size={13} />
            가져오기 시작
            {estimatedTotal > 0 && (
              <span className="text-white/70 font-normal">({estimatedTotal.toLocaleString()}행)</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function ColumnBadge({
  label,
  ok,
  optional = false,
}: {
  label: string;
  ok: boolean;
  optional?: boolean;
}) {
  if (ok) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-income/10 text-income">
        <Check size={9} />
        {label}
      </span>
    );
  }
  if (optional) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-surface-secondary text-text-tertiary">
        — {label}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-expense/10 text-expense">
      <AlertTriangle size={9} />
      {label} 없음
    </span>
  );
}
