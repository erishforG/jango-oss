export function evaluateAmountExpressionDetailed(input: string): { value: number; clamped: boolean } | null {
  const expr = (input ?? '').trim();
  if (!expr) return null;

  const normalized = expr.replace(/,/g, '').replace(/\s+/g, '');
  if (!/^[0-9()+\-*/.]+$/.test(normalized)) return null;

  const tokens = normalized.match(/\d+(?:\.\d+)?|[()+\-*/]/g);
  if (!tokens || tokens.join('') !== normalized) return null;

  const output: string[] = [];
  const ops: string[] = [];
  const precedence: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2 };

  const isUnary = (idx: number) => {
    if (tokens[idx] !== '-') return false;
    if (idx === 0) return true;
    const prev = tokens[idx - 1];
    return ['+', '-', '*', '/', '('].includes(prev);
  };

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    if (/^\d/.test(token)) {
      output.push(token);
      continue;
    }

    if (token === '-' && isUnary(i)) {
      output.push('0');
      ops.push('-');
      continue;
    }

    if (token in precedence) {
      while (ops.length) {
        const top = ops[ops.length - 1];
        if (!(top in precedence)) break;
        if (precedence[top] < precedence[token]) break;
        output.push(ops.pop() as string);
      }
      ops.push(token);
      continue;
    }

    if (token === '(') {
      ops.push(token);
      continue;
    }

    if (token === ')') {
      let foundLeft = false;
      while (ops.length) {
        const op = ops.pop() as string;
        if (op === '(') {
          foundLeft = true;
          break;
        }
        output.push(op);
      }
      if (!foundLeft) return null;
      continue;
    }

    return null;
  }

  while (ops.length) {
    const op = ops.pop() as string;
    if (op === '(' || op === ')') return null;
    output.push(op);
  }

  const stack: number[] = [];
  for (const token of output) {
    if (/^\d/.test(token)) {
      stack.push(Number(token));
      continue;
    }

    const b = stack.pop();
    const a = stack.pop();
    if (a == null || b == null) return null;

    switch (token) {
      case '+':
        stack.push(a + b);
        break;
      case '-':
        stack.push(a - b);
        break;
      case '*':
        stack.push(a * b);
        break;
      case '/':
        if (b === 0) return null;
        stack.push(a / b);
        break;
      default:
        return null;
    }
  }

  if (stack.length !== 1) return null;
  const result = stack[0];
  if (!Number.isFinite(result)) return null;

  const rounded = Math.round(result);
  return { value: rounded, clamped: false };
}

export function evaluateAmountExpression(input: string): number | null {
  return evaluateAmountExpressionDetailed(input)?.value ?? null;
}
