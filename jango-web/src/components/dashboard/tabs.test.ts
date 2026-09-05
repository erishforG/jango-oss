import { describe, expect, it } from 'vitest';
import {
  DASHBOARD_TAB_IDS,
  DEFAULT_DASHBOARD_TAB,
  resolveTabFromParam,
  shouldPersistTab,
} from './tabs';
import koDict from '../../i18n/ko.json';
import enDict from '../../i18n/en.json';
import jaDict from '../../i18n/ja.json';

describe('dashboard tabs', () => {
  it('exposes the four v0.5 tabs in expected order', () => {
    expect([...DASHBOARD_TAB_IDS]).toEqual([
      'overview',
      'netWorth',
      'cashFlow',
      'categories',
    ]);
  });

  it('defaults to overview', () => {
    expect(DEFAULT_DASHBOARD_TAB).toBe('overview');
  });

  it('has a dedicated accessible label for the tab list in every locale', () => {
    for (const dict of [koDict, enDict, jaDict]) {
      expect(dict.dashboard.tabsLabel).toBeTruthy();
      expect(dict.dashboard.tabsLabel).not.toBe(dict.dashboard.tabs.overview);
    }
  });

  describe('resolveTabFromParam', () => {
    it('returns overview when value is null', () => {
      expect(resolveTabFromParam(null)).toBe('overview');
    });

    it('returns overview when value is undefined', () => {
      expect(resolveTabFromParam(undefined)).toBe('overview');
    });

    it('returns overview when value is empty string', () => {
      expect(resolveTabFromParam('')).toBe('overview');
    });

    it('returns overview when value is unknown', () => {
      expect(resolveTabFromParam('budget')).toBe('overview');
      expect(resolveTabFromParam('NetWorth')).toBe('overview');
    });

    it.each(DASHBOARD_TAB_IDS)('round-trips known tab %s', (tab) => {
      expect(resolveTabFromParam(tab)).toBe(tab);
    });
  });

  describe('shouldPersistTab', () => {
    it('does not persist the default tab in the URL', () => {
      expect(shouldPersistTab('overview')).toBe(false);
    });

    it('persists non-default tabs', () => {
      expect(shouldPersistTab('netWorth')).toBe(true);
      expect(shouldPersistTab('cashFlow')).toBe(true);
      expect(shouldPersistTab('categories')).toBe(true);
    });
  });
});
