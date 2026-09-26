import { describe, it, expect } from 'vitest';
import {
  configStableKey,
  getStableCachedValue,
  layoutStableKey,
} from './stablePlotProps';

describe('layoutStableKey', () => {
  it('returns empty string for falsy layout', () => {
    expect(layoutStableKey(null)).toBe('');
    expect(layoutStableKey(undefined)).toBe('');
  });

  it('returns the same key for equivalent layouts', () => {
    const a = { barmode: 'stack', margin: { l: 40 } };
    const b = { barmode: 'stack', margin: { l: 40 } };
    expect(layoutStableKey(a)).toBe(layoutStableKey(b));
  });
});

describe('configStableKey', () => {
  it('ignores modebar button click handlers when building keys', () => {
    const a = {
      responsive: true,
      modeBarButtonsToAdd: [{ name: 'Download', click: () => 1 }],
    };
    const b = {
      responsive: true,
      modeBarButtonsToAdd: [{ name: 'Download', click: () => 2 }],
    };
    expect(configStableKey(a)).toBe(configStableKey(b));
  });
});

describe('getStableCachedValue', () => {
  it('reuses cached value when key is unchanged', () => {
    const cacheRef = { current: { key: '', value: null } };
    const first = getStableCachedValue(cacheRef, 'same', () => ({ ok: true }));
    const second = getStableCachedValue(cacheRef, 'same', () => ({ ok: false }));
    expect(second).toBe(first);
    expect(second).toEqual({ ok: true });
  });

  it('recomputes when key changes', () => {
    const cacheRef = { current: { key: '', value: null } };
    const first = getStableCachedValue(cacheRef, 'a', () => 1);
    const second = getStableCachedValue(cacheRef, 'b', () => 2);
    expect(first).toBe(1);
    expect(second).toBe(2);
  });
});
