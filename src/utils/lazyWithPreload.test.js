import { describe, it, expect, vi } from 'vitest';
import { lazyWithPreload } from './lazyWithPreload';

describe('lazyWithPreload', () => {
  it('exposes preload that triggers the import function', () => {
    const importFn = vi.fn(() => Promise.resolve({ default: () => null }));
    const Component = lazyWithPreload(importFn);

    expect(typeof Component.preload).toBe('function');
    Component.preload();
    expect(importFn).toHaveBeenCalledTimes(1);
  });

  it('preload invokes the import function', () => {
    const importFn = vi.fn(() => Promise.resolve({ default: () => null }));
    const Component = lazyWithPreload(importFn);

    Component.preload();
    expect(importFn).toHaveBeenCalledTimes(1);
  });

  it('repeated preload calls reuse the same import promise', () => {
    const importFn = vi.fn(() => Promise.resolve({ default: () => null }));
    const Component = lazyWithPreload(importFn);

    const first = Component.preload();
    const second = Component.preload();

    expect(first).toBe(second);
    expect(importFn).toHaveBeenCalledTimes(1);
  });
});
