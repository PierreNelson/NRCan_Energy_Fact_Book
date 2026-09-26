import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolveFocusTarget, scrollToId } from './scrollToId';

describe('scrollToId footnote focus', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('focuses the fn-num return button inside a footnote dd', () => {
    document.body.innerHTML = `
      <dd id="fn-asterisk-employment-chart">
        <a class="fn-num" href="#fn-asterisk-rf-employment-chart">*</a>
        <p>Footnote text</p>
      </dd>
    `;
    const dd = document.getElementById('fn-asterisk-employment-chart');
    const btn = dd.querySelector('a.fn-num');
    dd.scrollIntoView = () => {};

    scrollToId('fn-asterisk-employment-chart');

    expect(resolveFocusTarget(dd)).toBe(btn);
    expect(document.activeElement).toBe(btn);
  });

  it('focuses the fn-lnk marker inside a referrer span', () => {
    document.body.innerHTML = `
      <span id="fn-asterisk-rf-employment-chart">
        <a class="fn-lnk" href="#fn-asterisk-employment-chart">*</a>
      </span>
    `;
    const wrap = document.getElementById('fn-asterisk-rf-employment-chart');
    const link = wrap.querySelector('a.fn-lnk');
    wrap.scrollIntoView = () => {};

    scrollToId('fn-asterisk-rf-employment-chart');

    expect(resolveFocusTarget(wrap)).toBe(link);
    expect(document.activeElement).toBe(link);
  });
});
