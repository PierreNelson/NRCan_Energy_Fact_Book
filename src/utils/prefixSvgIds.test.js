import { prefixSvgIds, prepareInlineSvgMarkup } from './prefixSvgIds.js';

describe('prefixSvgIds', () => {
  it('prefixes id attributes and url(#) / href references', () => {
    const input = `<svg><defs><linearGradient id="grad"><stop/></linearGradient></defs><rect fill="url(#grad)"/><use href="#grad"/></svg>`;
    const out = prefixSvgIds(input, 'ai-demo');
    expect(out).toContain('id="ai-demo-grad"');
    expect(out).toContain('url(#ai-demo-grad)');
    expect(out).toContain('href="#ai-demo-grad"');
  });
});

describe('prepareInlineSvgMarkup', () => {
  it('strips aria-hidden and xml prologue', () => {
    const input = `<?xml version="1.0"?><svg aria-hidden="true"><text aria-hidden="true">Hi</text></svg>`;
    const out = prepareInlineSvgMarkup(input, 't1');
    expect(out).not.toMatch(/aria-hidden/);
    expect(out).not.toMatch(/<\?xml/);
    expect(out).toContain('<text');
  });
});
