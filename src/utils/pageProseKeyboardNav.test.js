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

  it('marks the sector energy trends title as its own tab stop', () => {
    document.body.innerHTML = `
      <article>
        <figure class="sector-energy-trends-infographic-figure">
          <h2 id="sector-energy-trends-chart-title" class="sector-energy-trends-infographic-title-overlay sector-energy-trends-chart-title">Trends in energy use and intensity by sector, 2000–2022</h2>
          <p class="sector-energy-trends-sector-title">Residential</p>
        </figure>
      </article>
    `;
    enhancePageProse(document.querySelector('article'));
    const title = document.querySelector('h2.sector-energy-trends-chart-title');
    expect(title.getAttribute('tabindex')).toBe('0');
    expect(title.getAttribute('data-prose-tab')).toBe('1');
    expect(document.querySelector('p.sector-energy-trends-sector-title').getAttribute('tabindex')).toBeNull();
  });

  it('marks paragraph chart titles as tab stops', () => {
    document.body.innerHTML = `
      <article>
        <h1>Energy use</h1>
        <p class="energy-use-chart-title">Primary and secondary energy use by sector</p>
        <p class="energy-use-chart-title">Breakdown of secondary energy use</p>
      </article>
    `;
    enhancePageProse(document.querySelector('article'));
    const titles = document.querySelectorAll('p.energy-use-chart-title');
    expect(titles[0].getAttribute('tabindex')).toBe('0');
    expect(titles[0].getAttribute('data-prose-tab')).toBe('1');
    expect(titles[1].getAttribute('tabindex')).toBe('0');
    expect(titles[1].getAttribute('data-prose-tab')).toBe('1');
  });

  it('marks each half of the energy intensity infographic as its own tab stop', () => {
    document.body.innerHTML = `
      <article>
        <h1>Energy intensity index</h1>
        <figure class="energy-intensity-index-infographic-figure">
          <div class="energy-intensity-index-infographic-wrapper" aria-hidden="true">
            <p class="energy-intensity-index-overlay-body">Per capita energy consumption was</p>
            <p class="energy-intensity-index-overlay-body">Canada used</p>
          </div>
          <p class="energy-intensity-index-visual-text energy-intensity-index-visual-text--left">Per capita energy consumption was 9% lower in 2022 than in 2000.</p>
          <p class="energy-intensity-index-visual-text energy-intensity-index-visual-text--right">Canada used 25% less energy per dollar of GDP in 2022 than in 2000.</p>
        </figure>
      </article>
    `;
    enhancePageProse(document.querySelector('article'));
    const halves = document.querySelectorAll('p.energy-intensity-index-visual-text');
    expect(halves).toHaveLength(2);
    expect(halves[0].getAttribute('tabindex')).toBe('0');
    expect(halves[0].getAttribute('data-prose-tab')).toBe('1');
    expect(halves[1].getAttribute('tabindex')).toBe('0');
    expect(halves[1].getAttribute('data-prose-tab')).toBe('1');
    document.querySelectorAll('p.energy-intensity-index-overlay-body').forEach((overlay) => {
      expect(overlay.getAttribute('tabindex')).toBeNull();
    });
  });

  it('marks environmental clean technology stats as separate tab stops', () => {
    document.body.innerHTML = `
      <article>
        <h1 class="wb-inv">Environmental and clean technology</h1>
        <div class="environmental-clean-technology-stats-block">
          <p class="environmental-clean-technology-heading environmental-clean-technology-visual-text">Environmental and clean technology (2022):</p>
          <p class="environmental-clean-technology-stat environmental-clean-technology-visual-text">$82.7 billion of GDP (2.9% of total GDP).</p>
          <p class="environmental-clean-technology-stat environmental-clean-technology-visual-text">333,176 jobs representing 1.7% of jobs in the Canadian economy.</p>
          <p class="environmental-clean-technology-stat environmental-clean-technology-visual-text">$20.9 billion in exports.</p>
        </div>
        <div class="environmental-clean-technology-stats-block">
          <p class="environmental-clean-technology-heading environmental-clean-technology-visual-text">Of this, clean energy alone accounted for</p>
          <p class="environmental-clean-technology-stat environmental-clean-technology-visual-text">1.5% of Canada's GDP.</p>
          <p class="environmental-clean-technology-stat environmental-clean-technology-visual-text">and employed 111,561 people.</p>
        </div>
        <p class="environmental-clean-technology-tsx environmental-clean-technology-visual-text">The TSX and TSX-Venture exchanges list 83 companies.</p>
      </article>
    `;
    enhancePageProse(document.querySelector('article'));
    const blocks = document.querySelectorAll('p.environmental-clean-technology-visual-text');
    expect(blocks).toHaveLength(8);
    blocks.forEach((block) => {
      expect(block.getAttribute('tabindex')).toBe('0');
      expect(block.getAttribute('data-prose-tab')).toBe('1');
    });
    expect(document.querySelector('h1.wb-inv').getAttribute('tabindex')).toBeNull();
  });

  it('marks each visual text block as its own tab stop', () => {
    document.body.innerHTML = `
      <article>
        <h1>Energy in our daily lives</h1>
        <p class="energy-in-daily-lives-visual-text">Residential energy use increased 6% since 2000,</p>
        <p class="energy-in-daily-lives-visual-text">but would have increased by 30% without energy efficiency improvements.</p>
      </article>
    `;
    enhancePageProse(document.querySelector('article'));
    const blocks = document.querySelectorAll('p.energy-in-daily-lives-visual-text');
    expect(blocks).toHaveLength(2);
    expect(blocks[0].getAttribute('tabindex')).toBe('0');
    expect(blocks[0].getAttribute('data-prose-tab')).toBe('1');
    expect(blocks[1].getAttribute('tabindex')).toBe('0');
    expect(blocks[1].getAttribute('data-prose-tab')).toBe('1');
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

  it('marks footnote paragraphs that are not inside a definition list', () => {
    document.body.innerHTML = `
      <article>
        <h1>Energy poverty</h1>
        <aside class="wb-fnote" role="note">
          <h2>Footnotes</h2>
          <p>Energy poverty rates are based on households.</p>
          <p>Energy excludes transportation.</p>
        </aside>
      </article>
    `;
    enhancePageProse(document.querySelector('article'));
    const notes = [...document.querySelectorAll('.wb-fnote p')];
    expect(notes).toHaveLength(2);
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

  it('marks a body paragraph whose own class contains -body', () => {
    document.body.innerHTML = `
      <article>
        <h2 class="public-energy-rdd-expenditures-chart-title">Canadian public expenditures on energy RD&D</h2>
        <details>
          <summary>Chart data table</summary>
        </details>
        <p class="public-energy-rdd-expenditures-body">Generally, federal and provincial/territorial energy RD&D spending continues to increase.</p>
        <aside class="wb-fnote" role="note">
          <h2>Footnotes</h2>
          <p>Provincial and territorial includes utilities.</p>
        </aside>
      </article>
    `;
    enhancePageProse(document.querySelector('article'));
    const body = document.querySelector('.public-energy-rdd-expenditures-body');
    expect(body.getAttribute('tabindex')).toBe('0');
    expect(body.getAttribute('data-prose-tab')).toBe('1');
    expect(body.getAttribute('aria-hidden')).toBeNull();
    expect(body.textContent).toContain('continues to increase');
  });

  it('does not mark overlay body copy inside a graphic', () => {
    document.body.innerHTML = `
      <article>
        <div role="img" aria-label="Energy intensity index">
          <p class="energy-intensity-index-overlay-body">Lower intensity</p>
        </div>
      </article>
    `;
    enhancePageProse(document.querySelector('article'));
    expect(document.querySelector('.energy-intensity-index-overlay-body').getAttribute('tabindex')).toBeNull();
  });

  it('marks paragraphs inside an intro wrapper', () => {
    document.body.innerHTML = `
      <article>
        <h1>Indexed GHG emissions intensity</h1>
        <div class="ghg-emissions-intensity-index-intro">
          <p>Since 2000, there has been a decoupling.</p>
          <p>In 2023, emissions increased slightly.</p>
        </div>
      </article>
    `;
    enhancePageProse(document.querySelector('article'));
    const paras = [...document.querySelectorAll('.ghg-emissions-intensity-index-intro p')];
    expect(paras).toHaveLength(2);
    expect(paras.every((p) => p.getAttribute('tabindex') === '0')).toBe(true);
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
