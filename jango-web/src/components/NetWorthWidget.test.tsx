import { describe, expect, it } from 'vitest';
import {
  computeDelta,
  computeSnapshotFromAccounts,
  flattenAccounts,
  shouldHideOnPath,
} from './netWorthWidgetUtils';
import type { Account } from '../types';

const acc = (over: Partial<Account>): Account => ({
  id: 'x',
  parentId: null,
  name: 'x',
  type: 'ASSET',
  balance: 0,
  isActive: true,
  ...over,
});

describe('NetWorthWidget — pure helpers', () => {
  describe('computeDelta', () => {
    it('returns up direction for positive delta with percent', () => {
      const res = computeDelta(120, 100);
      expect(res.delta).toBe(20);
      expect(res.direction).toBe('up');
      expect(res.percent).toBeCloseTo(20);
    });

    it('returns down direction for negative delta', () => {
      const res = computeDelta(80, 100);
      expect(res.delta).toBe(-20);
      expect(res.direction).toBe('down');
      expect(res.percent).toBeCloseTo(-20);
    });

    it('returns flat when curr equals prev', () => {
      expect(computeDelta(100, 100)).toEqual({ delta: 0, percent: 0, direction: 'flat' });
    });

    it('returns flat with null percent when curr or prev is missing', () => {
      expect(computeDelta(undefined, 100)).toEqual({ delta: 0, percent: null, direction: 'flat' });
      expect(computeDelta(100, undefined)).toEqual({ delta: 0, percent: null, direction: 'flat' });
    });

    it('returns null percent when prev is zero (no div/0)', () => {
      const res = computeDelta(50, 0);
      expect(res.delta).toBe(50);
      expect(res.direction).toBe('up');
      expect(res.percent).toBeNull();
    });

    it('uses absolute prev so negative→less-negative reads as positive percent', () => {
      // moving from -100 (liabilities-heavy) to -50 means net worth grew by 50
      const res = computeDelta(-50, -100);
      expect(res.delta).toBe(50);
      expect(res.direction).toBe('up');
      expect(res.percent).toBeCloseTo(50);
    });
  });

  describe('computeSnapshotFromAccounts', () => {
    it('sums leaf ASSET and LIABILITY balances and computes net worth', () => {
      const accounts: Account[] = [
        acc({ id: '1', type: 'ASSET', balance: 1_000_000 }),
        acc({ id: '2', type: 'ASSET', balance: 500_000 }),
        acc({ id: '3', type: 'LIABILITY', balance: 300_000 }),
        acc({ id: '4', type: 'EQUITY', balance: 1_200_000 }),
        acc({ id: '5', type: 'INCOME', balance: 99_999 }),
      ];
      const snap = computeSnapshotFromAccounts(accounts);
      expect(snap.assets).toBe(1_500_000);
      expect(snap.liabilities).toBe(300_000);
      expect(snap.netWorth).toBe(1_200_000);
    });

    it('walks nested groups and skips group totals to avoid double counting', () => {
      const accounts: Account[] = [
        acc({
          id: 'g1',
          type: 'ASSET',
          isGroup: true,
          balance: 999_999, // group balance should be ignored
          children: [
            acc({ id: 'g1-a', type: 'ASSET', balance: 200_000 }),
            acc({ id: 'g1-b', type: 'ASSET', balance: 300_000 }),
          ],
        }),
        acc({ id: 'l1', type: 'LIABILITY', balance: 100_000 }),
      ];
      const snap = computeSnapshotFromAccounts(accounts);
      expect(snap.assets).toBe(500_000);
      expect(snap.liabilities).toBe(100_000);
      expect(snap.netWorth).toBe(400_000);
    });

    it('returns zeros for empty accounts', () => {
      expect(computeSnapshotFromAccounts([])).toEqual({ assets: 0, liabilities: 0, netWorth: 0 });
    });

    it('tolerates NaN balance via coercion to zero', () => {
      const accounts: Account[] = [
        acc({ id: '1', type: 'ASSET', balance: Number.NaN as unknown as number }),
        acc({ id: '2', type: 'ASSET', balance: 100 }),
      ];
      const snap = computeSnapshotFromAccounts(accounts);
      expect(snap.assets).toBe(100);
    });
  });

  describe('flattenAccounts', () => {
    it('walks nested children', () => {
      const tree: Account[] = [
        acc({
          id: 'root',
          isGroup: true,
          children: [acc({ id: 'a' }), acc({ id: 'b', children: [acc({ id: 'b1' })] })],
        }),
      ];
      const ids = flattenAccounts(tree).map((a) => a.id).sort();
      expect(ids).toEqual(['a', 'b', 'b1', 'root']);
    });
  });

  describe('shouldHideOnPath', () => {
    it('hides on auth and standalone routes', () => {
      expect(shouldHideOnPath('/login')).toBe(true);
      expect(shouldHideOnPath('/privacy')).toBe(true);
      expect(shouldHideOnPath('/terms')).toBe(true);
      expect(shouldHideOnPath('/help')).toBe(true);
      expect(shouldHideOnPath('/invite')).toBe(true);
      expect(shouldHideOnPath('/invite/abc123')).toBe(true);
      expect(shouldHideOnPath('/admin')).toBe(true);
      expect(shouldHideOnPath('/admin/rules')).toBe(true);
    });

    it('shows on dashboard / app routes', () => {
      expect(shouldHideOnPath('/')).toBe(false);
      expect(shouldHideOnPath('/transactions')).toBe(false);
      expect(shouldHideOnPath('/reports')).toBe(false);
      expect(shouldHideOnPath('/settings')).toBe(false);
    });

    it('does not match unrelated paths that contain auth keywords as substring', () => {
      // does not start with /login → should not hide
      expect(shouldHideOnPath('/settings/login-redirect')).toBe(false);
    });
  });
});
