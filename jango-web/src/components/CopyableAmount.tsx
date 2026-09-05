import { useState, useCallback } from 'react';
import { useToast } from './Toast';
import { useTranslation } from '../i18n/useTranslation';

type Props = {
  /** 표시할 포맷된 금액 문자열 (예: "₩1,234,567") */
  formatted: string;
  /** 복사할 원본 숫자값 */
  rawValue: number;
  /** 추가 CSS 클래스 */
  className?: string;
  /** span 대신 다른 태그 사용 */
  as?: 'span' | 'p' | 'td' | 'div';
};

/**
 * 금액을 표시하고, 클릭 시 숫자만 클립보드에 복사하는 공통 컴포넌트.
 * - 숫자만 복사 (쉼표/통화기호 제외)
 * - hover 시 커서 pointer + 복사 힌트
 * - 복사 완료 시 토스트 표시
 */
export default function CopyableAmount({ formatted, rawValue, className = '', as: Tag = 'span' }: Props) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    const text = String(Math.abs(rawValue));
    try {
      await navigator.clipboard.writeText(text);
      toast(t('common.copied'), 'success');
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      toast(t('common.copied'), 'success');
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }, [rawValue, t, toast]);

  return (
    <Tag
      className={`cursor-pointer select-none group/copy inline-flex items-center ${className}`}
      onClick={handleCopy}
      title={t('common.copyAmount')}
      role="button"
      tabIndex={0}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleCopy();
        }
      }}
    >
      <span className="whitespace-nowrap">{formatted}</span>
      <span
        className={`ml-1 text-[10px] text-text-tertiary ${copied ? 'inline text-income' : 'hidden group-hover/copy:inline'}`}
        aria-hidden
      >
        {copied ? '✓' : '📋'}
      </span>
    </Tag>
  );
}
