import { describe, it, expect } from 'vitest';
import { getText, TRANSLATIONS } from '../utils/translations';

describe('getText', () => {
  it('returns English strings', () => {
    expect(getText('breadcrumb_product_title', 'en')).toBe('Energy Fact Book');
  });

  it('returns French strings', () => {
    expect(getText('breadcrumb_product_title', 'fr')).toBeTruthy();
    expect(getText('breadcrumb_product_title', 'fr')).not.toBe('breadcrumb_product_title');
  });

  it('falls back to key when missing', () => {
    expect(getText('no_such_key_xyz', 'en')).toBe('no_such_key_xyz');
  });

  it('has both language catalogs', () => {
    expect(TRANSLATIONS.en).toBeTruthy();
    expect(TRANSLATIONS.fr).toBeTruthy();
  });
});
