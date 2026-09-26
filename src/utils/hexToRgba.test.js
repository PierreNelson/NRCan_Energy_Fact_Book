import { describe, it, expect } from 'vitest';
import hexToRgba from './hexToRgba';

describe('hexToRgba', () => {
  it('converts hex with and without hash', () => {
    expect(hexToRgba('#245e7f', 0.3)).toBe('rgba(36, 94, 127, 0.3)');
    expect(hexToRgba('CE8003', 1)).toBe('rgba(206, 128, 3, 1)');
  });

  it('returns original value when invalid', () => {
    expect(hexToRgba('not-a-color', 0.5)).toBe('not-a-color');
  });
});
