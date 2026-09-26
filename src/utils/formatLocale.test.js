import { describe, it, expect } from 'vitest';
import { formatLocaleNumber, formatLocalePct, localeForLang } from './formatLocale';

describe('formatLocale', () => {
  it('picks locale', () => {
    expect(localeForLang('en')).toBe('en-CA');
    expect(localeForLang('fr')).toBe('fr-CA');
  });

  it('formats numbers and blanks', () => {
    expect(formatLocaleNumber(1234.5, 'en', { maximumFractionDigits: 1 })).toMatch(/1,234/);
    expect(formatLocaleNumber(null, 'en')).toBe('—');
  });

  it('formats percents', () => {
    expect(formatLocalePct(12.5, 'en', { maximumFractionDigits: 1 })).toBe('12.5%');
    expect(formatLocalePct(null, 'fr')).toBe('—');
  });
});
