import { describe, expect, it } from 'vitest';
import { chunk } from './chunk';

describe('chunk', () => {
  it('splits evenly divisible arrays into equal-size chunks', () => {
    expect(chunk([1, 2, 3, 4], 2)).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });

  it('puts the remainder in a smaller final chunk', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('returns a single chunk when items fit within size', () => {
    expect(chunk([1, 2, 3], 50)).toEqual([[1, 2, 3]]);
  });

  it('returns one chunk of exactly size items when the count equals size', () => {
    const items = Array.from({ length: 50 }, (_, i) => i);
    expect(chunk(items, 50)).toEqual([items]);
  });

  it('splits into two chunks when the count is one over size', () => {
    const items = Array.from({ length: 51 }, (_, i) => i);
    const result = chunk(items, 50);
    expect(result).toHaveLength(2);
    expect(result[0]).toHaveLength(50);
    expect(result[1]).toEqual([50]);
  });

  it('returns an empty array for empty input', () => {
    expect(chunk([], 50)).toEqual([]);
  });

  it('throws for a non-positive size', () => {
    expect(() => chunk([1, 2], 0)).toThrow();
    expect(() => chunk([1, 2], -1)).toThrow();
  });
});
