import { describe, it, expect } from 'vitest';
import { sanitizeHtml } from './sanitizeHtml';

describe('sanitizeHtml', () => {
  it('allows simple emphasis tags', () => {
    expect(sanitizeHtml('<strong>ok</strong>')).toContain('<strong>ok</strong>');
  });

  it('strips script tags', () => {
    const out = sanitizeHtml('<img src=x onerror=alert(1)><script>alert(1)</script>hi');
    expect(out).not.toContain('script');
    expect(out).not.toContain('onerror');
    expect(out).toContain('hi');
  });
});
