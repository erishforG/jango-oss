import { useMemo, useState } from 'react';
import { formatNumber } from '../utils/format';
import { evaluateAmountExpressionDetailed } from '../utils/amountExpression';

export default function AmountExpressionInput({
  value,
  onChange,
  placeholder,
  className,
  inputClassName,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
}) {
  const [focused, setFocused] = useState(false);

  const resolved = useMemo(() => evaluateAmountExpressionDetailed(value), [value]);
  const displayValue = focused ? value : resolved != null ? formatNumber(String(resolved.value)) : value;

  return (
    <div className={className}>
      <input
        type="text"
        inputMode="text"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        value={displayValue}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={inputClassName}
      />
      {focused && value.trim() && (
        resolved == null ? (
          <p className="mt-1 text-[11px] text-expense text-right">수식 오류</p>
        ) : resolved.value < 0 ? (
          <p className="mt-1 text-[11px] text-expense text-right">= {formatNumber(String(resolved.value))}원 (음수)</p>
        ) : (
          <p className="mt-1 text-[11px] text-text-tertiary text-right">= {formatNumber(String(resolved.value))}원</p>
        )
      )}
    </div>
  );
}
