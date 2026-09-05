import { describe, expect, it } from 'vitest';
import { evaluateAmountExpression, evaluateAmountExpressionDetailed } from './amountExpression';

describe('evaluateAmountExpression', () => {
  // ── 기본 사칙연산 ──────────────────────────────────────────────────────────
  it('단순 정수 반환', () => {
    expect(evaluateAmountExpression('42')).toBe(42);
  });

  it('덧셈', () => {
    expect(evaluateAmountExpression('1000+500')).toBe(1500);
  });

  it('뺄셈', () => {
    expect(evaluateAmountExpression('5000-1200')).toBe(3800);
  });

  it('곱셈', () => {
    expect(evaluateAmountExpression('300*4')).toBe(1200);
  });

  it('나눗셈 (정수 결과)', () => {
    expect(evaluateAmountExpression('1000/4')).toBe(250);
  });

  it('나눗셈 결과는 반올림', () => {
    // 10 / 3 = 3.333... → 반올림 3
    expect(evaluateAmountExpression('10/3')).toBe(3);
  });

  // ── 연산자 우선순위 ──────────────────────────────────────────────────────
  it('곱셈이 덧셈보다 우선', () => {
    expect(evaluateAmountExpression('2+3*4')).toBe(14);
  });

  it('나눗셈이 뺄셈보다 우선', () => {
    expect(evaluateAmountExpression('10-6/2')).toBe(7);
  });

  // ── 괄호 ────────────────────────────────────────────────────────────────
  it('괄호로 우선순위 변경', () => {
    expect(evaluateAmountExpression('(2+3)*4')).toBe(20);
  });

  it('중첩 괄호', () => {
    expect(evaluateAmountExpression('((2+3)*2)+1')).toBe(11);
  });

  // ── 쉼표 구분 숫자 ───────────────────────────────────────────────────────
  it('쉼표 포함 숫자 파싱 (1,000,000)', () => {
    expect(evaluateAmountExpression('1,000,000')).toBe(1000000);
  });

  it('쉼표 포함 숫자 포함 식', () => {
    expect(evaluateAmountExpression('1,000+500')).toBe(1500);
  });

  // ── unary minus ──────────────────────────────────────────────────────────
  it('음수 리터럴: -5', () => {
    expect(evaluateAmountExpression('-5')).toBe(-5);
  });

  it('식에서 unary minus: 3+-2', () => {
    expect(evaluateAmountExpression('3+-2')).toBe(1);
  });

  it('괄호 안 unary minus: (-3)*2', () => {
    expect(evaluateAmountExpression('(-3)*2')).toBe(-6);
  });

  // ── 0으로 나누기 ────────────────────────────────────────────────────────
  it('0으로 나누면 null 반환', () => {
    expect(evaluateAmountExpression('10/0')).toBeNull();
  });

  it('0으로 나누기 (변수식)', () => {
    expect(evaluateAmountExpression('(5+5)/0')).toBeNull();
  });

  // ── 괄호 미스매칭 ───────────────────────────────────────────────────────
  it('닫힘 괄호만 있으면 null', () => {
    expect(evaluateAmountExpression('1+2)')).toBeNull();
  });

  it('열림 괄호만 있으면 null', () => {
    expect(evaluateAmountExpression('(1+2')).toBeNull();
  });

  // ── 잘못된 입력 ─────────────────────────────────────────────────────────
  it('빈 문자열은 null', () => {
    expect(evaluateAmountExpression('')).toBeNull();
  });

  it('공백만 있으면 null', () => {
    expect(evaluateAmountExpression('   ')).toBeNull();
  });

  it('알파벳 포함 식은 null', () => {
    expect(evaluateAmountExpression('1+a')).toBeNull();
  });

  it('후행 연산자 (+로 끝) 는 null', () => {
    expect(evaluateAmountExpression('10+')).toBeNull();
  });

  it('연속 연산자는 null', () => {
    expect(evaluateAmountExpression('1++2')).toBeNull();
  });

  // ── 소수 ────────────────────────────────────────────────────────────────
  it('소수 입력 반올림', () => {
    expect(evaluateAmountExpression('1.6')).toBe(2);
    expect(evaluateAmountExpression('1.4')).toBe(1);
  });

  it('소수 계산 후 반올림', () => {
    // 1.5 + 1.5 = 3.0 → 3
    expect(evaluateAmountExpression('1.5+1.5')).toBe(3);
  });

  // ── 오버플로 / 큰 숫자 ──────────────────────────────────────────────────
  it('MAX_SAFE_INTEGER 부근 숫자도 처리', () => {
    const big = String(Number.MAX_SAFE_INTEGER); // 9007199254740991
    expect(evaluateAmountExpression(big)).toBe(Number.MAX_SAFE_INTEGER);
  });
});

describe('evaluateAmountExpressionDetailed', () => {
  it('clamped 필드는 항상 false', () => {
    const result = evaluateAmountExpressionDetailed('100+200');
    expect(result).toEqual({ value: 300, clamped: false });
  });

  it('유효하지 않은 식은 null', () => {
    expect(evaluateAmountExpressionDetailed('')).toBeNull();
  });
});
