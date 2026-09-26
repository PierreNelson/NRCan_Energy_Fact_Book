import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  enhancePageProse,
  markProseTabStop,
  enablePageProseKeyboardNav,
} from './pageProseKeyboardNav';

describe('pageProseKeyboardNav', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('marks page h1 and intro paragraphs as tab stops without aria-hidden', () => {
    document.body.innerHTML = `
      <div class="stacked-page-wrapper">
        <article>
          <header>
            <h1 class="energy-production-title">Energy production and supply</h1>
            <p class="energy-production-subtitle">Canada: a global energy leader</p>
          </header>
          <p class="energy-production-narrative">Canada produced 42% more.</p>
          <button type="button">2023</button>
        </article>
      </div>
    `;
    enhancePageProse(document.querySelector('article'));

    const h1 = document.querySelector('h1');
    const sub = document.querySelector('.energy-production-subtitle');
    const nar = document.querySelector('.energy-production-narrative');

    expect(h1.getAttribute('tabindex')).toBe('0');
    expect(sub.getAttribute('tabindex')).toBe('0');
    expect(nar.getAttribute('tabindex')).toBe('0');
    expect(h1.getAttribute('aria-hidden')).toBeNull();
    expect(sub.getAttribute('aria-hidden')).toBeNull();
    expect(nar.textContent).toContain('42%');
  });

  it('marks Canadian Energy Production body paragraphs', () => {
    document.body.innerHTML = `
      <article>
        <h1>Canadian energy production</h1>
        <div class="canadian-energy-production-body">
          <p class="canadian-energy-production-paragraph">Para one.</p>
          <p class="canadian-energy-production-paragraph">Para two.</p>
        </div>
      </article>
    `;
    enhancePageProse(document.querySelector('article'));
    const paras = [...document.querySelectorAll('.canadian-energy-production-paragraph')];
    expect(paras.every((p) => p.getAttribute('tabindex') === '0')).toBe(true);
  });

  it('marks chart titles and skips wb-inv twins', () => {
    document.body.innerHTML = `
      <article>
        <h1 class="wb-inv">Hidden twin</h1>
        <h1>Visible title</h1>
        <h2 class="canada-energy-supply-chart-title">Pie chart title</h2>
        <h3 class="crude-oil-international-graphic-title">Capsule title</h3>
        <h4 class="nominal-gdp-chart-title">Nominal GDP chart title</h4>
      </article>
    `;
    enhancePageProse(document.querySelector('article'));
    expect(document.querySelector('h1.wb-inv').getAttribute('tabindex')).toBeNull();
    expect(document.querySelector('h1:not(.wb-inv)').getAttribute('tabindex')).toBe('0');
    expect(document.querySelector('h2').getAttribute('tabindex')).toBe('0');
    expect(document.querySelector('h3').getAttribute('tabindex')).toBe('0');
    expect(document.querySelector('h4').getAttribute('tabindex')).toBe('0');
  });

  it('marks h2/h3 page subtitles as tab stops', () => {
    document.body.innerHTML = `
      <article>
        <h1 class="nominal-gdp-title">Economic contributions</h1>
        <h2 class="nominal-gdp-subtitle">Nominal gross domestic product (2024)</h2>
        <h3 class="nominal-gdp-subtitle2">Energy's nominal GDP contribution for Canada</h3>
      </article>
    `;
    enhancePageProse(document.querySelector('article'));
    expect(document.querySelector('h1').getAttribute('tabindex')).toBe('0');
    expect(document.querySelector('h2').getAttribute('tabindex')).toBe('0');
    expect(document.querySelector('h3').getAttribute('tabindex')).toBe('0');
  });

  it('marks footnote heading and body paragraphs as tab stops', () => {
    document.body.innerHTML = `
      <article>
        <h1>Visible title</h1>
        <aside class="wb-fnote" role="note">
          <h2>Footnotes</h2>
          <dl>
            <dd id="fn1"><p>Note one text.</p></dd>
            <dd id="fn2"><p>Note two text.</p></dd>
          </dl>
        </aside>
      </article>
    `;
    enhancePageProse(document.querySelector('article'));
    expect(document.querySelector('.wb-fnote h2').getAttribute('tabindex')).toBe('0');
    const notes = [...document.querySelectorAll('.wb-fnote dd p')];
    expect(notes.every((p) => p.getAttribute('tabindex') === '0')).toBe(true);
  });

  it('marks formula and bullet list items', () => {
    document.body.innerHTML = `
      <article>
        <h1>Title</h1>
        <p class="canada-energy-supply-formula">TES = Production</p>
        <ul class="canada-energy-supply-bullets">
          <li>Fossil fuels 76%</li>
          <li>Renewables 16.5%</li>
        </ul>
      </article>
    `;
    enhancePageProse(document.querySelector('article'));
    expect(document.querySelector('.canada-energy-supply-formula').getAttribute('tabindex')).toBe('0');
    expect(
      [...document.querySelectorAll('.canada-energy-supply-bullets li')].every(
        (li) => li.getAttribute('tabindex') === '0',
      ),
    ).toBe(true);
  });

  it('marks summary paragraphs and li.-bullet items without ul.-bullets', () => {
    document.body.innerHTML = `
      <article>
        <h1>Canada's global energy trade</h1>
        <p class="canada-global-energy-trade-summary">Exported nearly $1.5 trillion.</p>
        <ul>
          <li class="government-revenues-bullet">Petroleum averaged $24 billion.</li>
          <li class="government-revenues-bullet">Energy sector share was 8.0%.</li>
        </ul>
      </article>
    `;
    enhancePageProse(document.querySelector('article'));
    expect(
      document.querySelector('.canada-global-energy-trade-summary').getAttribute('tabindex'),
    ).toBe('0');
    expect(
      [...document.querySelectorAll('.government-revenues-bullet')].every(
        (li) => li.getAttribute('tabindex') === '0',
      ),
    ).toBe(true);
  });

  it('enablePageProseKeyboardNav enhances stacked wrappers', () => {
    document.body.innerHTML = `
      <div class="stacked-page-wrapper" id="energy-production">
        <article>
          <h1>Energy production and supply</h1>
          <p class="energy-production-subtitle">Subtitle</p>
        </article>
      </div>
    `;
    const stop = enablePageProseKeyboardNav(document);
    expect(document.querySelector('h1').getAttribute('tabindex')).toBe('0');
    expect(document.querySelector('p').getAttribute('tabindex')).toBe('0');
    stop();
  });

  it('markProseTabStop is idempotent', () => {
    const p = document.createElement('p');
    p.className = 'energy-production-narrative';
    p.textContent = 'Hello';
    document.body.appendChild(p);
    expect(markProseTabStop(p)).toBe(true);
    expect(markProseTabStop(p)).toBe(true);
    expect(p.getAttribute('data-prose-tab')).toBe('1');
  });
});
