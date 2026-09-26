import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  enableChartDataTableCellNavigation,
  labelForCell,
  columnHeadersFor,
  columnHeadersAnnouncement,
  enhanceTable,
  parseColumnHeader,
  expandMetricAbbrev,
  sanitizeSummaryControls,
  speakHeaderLabel,
} from './chartDataTableCellNav';

describe('expandMetricAbbrev', () => {
  it('expands Res./Prod./Exp.', () => {
    document.documentElement.lang = 'en';
    expect(expandMetricAbbrev('Res.')).toBe('reserves');
    expect(expandMetricAbbrev('Prod.')).toBe('production');
    expect(expandMetricAbbrev('Exp.')).toBe('exports');
  });
});

describe('parseColumnHeader', () => {
  it('extracts percent unit from China (%)', () => {
    document.documentElement.lang = 'en';
    expect(parseColumnHeader('China (%)')).toEqual({
      name: 'China',
      unitSpoken: 'percent',
      unitRaw: '%',
    });
  });

  it('does not treat index base year (2002=100) as a spoken unit', () => {
    document.documentElement.lang = 'en';
    expect(parseColumnHeader('Energy CPI (2002=100)')).toEqual({
      name: 'Energy CPI',
      unitSpoken: '',
      unitRaw: '',
    });
    expect(parseColumnHeader('CPI excluding energy (2000=100)')).toEqual({
      name: 'CPI excluding energy',
      unitSpoken: '',
      unitRaw: '',
    });
  });

  it('speaks money units as millions/billions of dollars', () => {
    document.documentElement.lang = 'en';
    expect(parseColumnHeader('2009 ($ millions)')).toEqual({
      name: '2009',
      unitSpoken: 'millions of dollars',
      unitRaw: '$ millions',
    });
    expect(speakHeaderLabel('2009 ($ millions)')).toBe('2009, millions of dollars');
    document.documentElement.lang = 'fr';
    expect(parseColumnHeader('2009 (millions $)')).toEqual({
      name: '2009',
      unitSpoken: 'millions de dollars',
      unitRaw: 'millions $',
    });
  });

  it('speaks C$ millions as millions of Canadian dollars', () => {
    document.documentElement.lang = 'en';
    expect(parseColumnHeader('Exports (C$ millions)')).toEqual({
      name: 'Exports',
      unitSpoken: 'millions of Canadian dollars',
      unitRaw: 'C$ millions',
    });
    expect(speakHeaderLabel('Exports (C$ millions)')).toBe(
      'Exports, millions of Canadian dollars',
    );
    document.documentElement.lang = 'fr';
    expect(parseColumnHeader('Exportations (millions de $ CAN)')).toEqual({
      name: 'Exportations',
      unitSpoken: 'millions de dollars canadiens',
      unitRaw: 'millions de $ CAN',
    });
  });
});

describe('columnHeadersFor multi-row', () => {
  it('combines group + Res/Prod/Exp without mixing columns', () => {
    document.documentElement.lang = 'en';
    document.body.innerHTML = `
      <table>
        <thead>
          <tr>
            <th rowspan="2">Year</th>
            <th colspan="3">Crude oil</th>
            <th colspan="3">Electricity</th>
          </tr>
          <tr>
            <th>Res.</th><th>Prod.</th><th>Exp.</th>
            <th>Res.</th><th>Prod.</th><th>Exp.</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">2021</th>
            <td>4</td><td>4</td><td>3</td>
            <td>8</td><td>7</td><td>3</td>
          </tr>
        </tbody>
      </table>
    `;
    const headers = columnHeadersFor(document.querySelector('table'));
    expect(headers[0]).toMatch(/Year/i);
    expect(headers[1].toLowerCase()).toContain('crude oil');
    expect(headers[1].toLowerCase()).toContain('reserves');
    expect(headers[2].toLowerCase()).toContain('crude oil');
    expect(headers[2].toLowerCase()).toContain('production');
    expect(headers[3].toLowerCase()).toContain('exports');
    expect(headers[5].toLowerCase()).toContain('electricity');
    expect(headers[5].toLowerCase()).toContain('production');

    const announce = columnHeadersAnnouncement(headers);
    expect(announce.toLowerCase()).toContain('crude oil');
    expect(announce.toLowerCase()).toContain('electricity');
    // Should not spam Res. six times
    expect((announce.match(/Res\./g) || []).length).toBe(0);
  });
});

describe('labelForCell', () => {
  it('includes spoken unit after the value for year tables', () => {
    document.documentElement.lang = 'en';
    document.body.innerHTML = `
      <table>
        <thead><tr><th>Year</th><th>Canada (%)</th><th>China (%)</th></tr></thead>
        <tbody>
          <tr><th scope="row">2023</th><td>4</td><td>21</td></tr>
        </tbody>
      </table>
    `;
    const table = document.querySelector('table');
    const headers = columnHeadersFor(table);
    const row = table.querySelector('tbody tr');
    const [, canada, china] = row.cells;
    expect(labelForCell(canada, headers)).toBe('Canada, 2023, 4 percent');
    expect(labelForCell(china, headers)).toBe('China, 2023, 21 percent');
  });

  it('does not append index base year after CPI cell values', () => {
    document.documentElement.lang = 'en';
    document.body.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Year</th>
            <th>Energy CPI (2002=100)</th>
            <th>Total CPI (2002=100)</th>
          </tr>
        </thead>
        <tbody>
          <tr><th scope="row">2025</th><td>190</td><td>165</td></tr>
        </tbody>
      </table>
    `;
    const table = document.querySelector('table');
    const headers = columnHeadersFor(table);
    const row = table.querySelector('tbody tr');
    const [, energy, total] = row.cells;
    expect(labelForCell(energy, headers)).toBe('Energy CPI, 2025, 190');
    expect(labelForCell(total, headers)).toBe('Total CPI, 2025, 165');
  });

  it('reads province × year GDP cells as province, year, value, millions of dollars', () => {
    document.documentElement.lang = 'en';
    document.body.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Province/Territory</th>
            <th>2009 ($ millions)</th>
            <th>2010 ($ millions)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">British Columbia</th>
            <td>10,250</td>
            <td>11,000</td>
          </tr>
        </tbody>
      </table>
    `;
    const table = document.querySelector('table');
    const headers = columnHeadersFor(table);
    const row = table.querySelector('tbody tr');
    const [, y2009, y2010] = row.cells;
    expect(labelForCell(y2009, headers)).toBe(
      'British Columbia, 2009, 10,250, millions of dollars',
    );
    expect(labelForCell(y2010, headers)).toBe(
      'British Columbia, 2010, 11,000, millions of dollars',
    );
    expect(columnHeadersAnnouncement(headers)).toBe(
      'Province/Territory, 2009, 2010. Values in millions of dollars',
    );
  });

  it('does not speak a dollar glyph before billions of dollars', () => {
    document.documentElement.lang = 'en';
    document.body.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Year</th>
            <th>Direct GDP (billions of dollars)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">2024</th>
            <td>$232</td>
          </tr>
        </tbody>
      </table>
    `;
    const table = document.querySelector('table');
    const headers = columnHeadersFor(table);
    const cell = table.querySelector('tbody td');
    expect(labelForCell(cell, headers)).toBe(
      'Direct GDP, 2024, 232 billions of dollars',
    );
  });

  it('reads rankings cells as resource + metric + ranking + value', () => {
    document.documentElement.lang = 'en';
    document.body.innerHTML = `
      <div class="static-rankings-scroll-container">
        <table>
          <caption>Global energy rankings for Canada, 2021</caption>
          <thead>
            <tr>
              <th></th>
              <th>Proved reserve/capacity</th>
              <th>Production</th>
              <th>Exports</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row" class="resource-cell">Crude oil</th>
              <td>4</td><td>4</td><td>3</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
    const table = document.querySelector('table');
    const headers = columnHeadersFor(table);
    const row = table.querySelector('tbody tr');
    const [, reserves, production, exports] = row.cells;
    expect(labelForCell(reserves, headers, table).toLowerCase()).toBe(
      'crude oil reserves, ranking, 4',
    );
    expect(labelForCell(production, headers, table).toLowerCase()).toBe(
      'crude oil production, ranking, 4',
    );
    expect(labelForCell(exports, headers, table).toLowerCase()).toBe(
      'crude oil exports, ranking, 3',
    );
  });

  it('speaks not applicable for dash values', () => {
    document.documentElement.lang = 'en';
    document.body.innerHTML = `
      <div class="static-rankings-scroll-container">
        <table>
          <caption>Global energy rankings</caption>
          <thead>
            <tr><th></th><th>Production</th><th>Exports</th></tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Hydroelectricity</th>
              <td>3</td><td>-</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
    const table = document.querySelector('table');
    const headers = columnHeadersFor(table);
    const dashCell = table.querySelectorAll('tbody td')[1];
    expect(labelForCell(dashCell, headers, table).toLowerCase()).toBe(
      'hydroelectricity exports, ranking, not applicable',
    );
  });

  it('reads yearly rankings grid cells with ranking before the value', () => {
    document.documentElement.lang = 'en';
    document.body.innerHTML = `
      <div class="table-responsive">
        <table>
          <caption>Global energy rankings for Canada by resource type and year</caption>
          <thead>
            <tr>
              <th rowspan="2">Year</th>
              <th colspan="3">Crude oil</th>
              <th colspan="3">Electricity</th>
            </tr>
            <tr>
              <th>Res.</th><th>Prod.</th><th>Exp.</th>
              <th>Res.</th><th>Prod.</th><th>Exp.</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">2007</th>
              <td>4</td><td>4</td><td>3</td>
              <td>8</td><td>7</td><td>3</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
    const table = document.querySelector('table');
    const headers = columnHeadersFor(table);
    const row = table.querySelector('tbody tr');
    expect(labelForCell(row.cells[2], headers, table).toLowerCase()).toBe(
      '2007, crude oil production, ranking, 4',
    );
    expect(labelForCell(row.cells[6], headers, table).toLowerCase()).toBe(
      '2007, electricity exports, ranking, 3',
    );
  });
});

describe('enableChartDataTableCellNavigation', () => {
  let cleanup;

  beforeEach(() => {
    document.documentElement.lang = 'en';
    cleanup = enableChartDataTableCellNavigation(document);
  });

  afterEach(() => {
    cleanup?.();
    document.body.innerHTML = '';
  });

  it('focuses title then headers; headers omit repeating caption', async () => {
    document.body.innerHTML = `
      <div class="energy-production-rankings-section">
        <h3 class="energy-production-rankings-title">Global energy rankings for Canada, 2021</h3>
        <div class="static-rankings-scroll-container">
          <table>
            <caption class="wb-inv">Global energy rankings for Canada, 2021</caption>
            <thead>
              <tr>
                <th></th>
                <th>Proved reserve/capacity</th>
                <th>Production</th>
                <th>Exports</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Crude oil</th>
                <td>4</td><td>4</td><td>3</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
    enhanceTable(document.querySelector('table'));

    const title = document.querySelector('h3');
    expect(title.getAttribute('tabindex')).toBe('0');
    expect(title.getAttribute('aria-label')).toMatch(/Global energy rankings/);

    const sentinel = document.querySelector('.chart-table-colheaders');
    const label = sentinel.getAttribute('aria-label');
    expect(label).toMatch(/Column headers:/);
    expect(label).not.toMatch(/^Table:/);
    expect(label).toMatch(/Production/);
    expect(label).toMatch(/Exports/);
  });

  it('moves between cells with arrow keys', () => {
    document.body.innerHTML = `
      <div class="table-responsive">
        <table>
          <thead><tr><th>Year</th><th>A (%)</th><th>B (%)</th></tr></thead>
          <tbody>
            <tr><th scope="row">1</th><td>a1</td><td>b1</td></tr>
            <tr><th scope="row">2</th><td>a2</td><td>b2</td></tr>
          </tbody>
        </table>
      </div>
    `;
    enhanceTable(document.querySelector('table'));

    const start = document.querySelector('tbody td');
    start.focus();
    start.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(document.activeElement.textContent.trim()).toBe('b1');
  });

  it('removes triangle glyphs from summary and names it as a button', () => {
    document.body.innerHTML = `
      <details class="data-table-wrapper">
        <summary>
          <span aria-hidden="true">▶</span>
          Chart data table
          <span class="wb-inv"> Press Enter to open or close.</span>
        </summary>
      </details>
    `;
    sanitizeSummaryControls(document);
    const summary = document.querySelector('summary');
    expect(summary.querySelector('.chart-summary-chevron').textContent).toBe('');
    expect(summary.getAttribute('aria-label')).toBe('Chart data table');
    expect(summary.getAttribute('aria-roledescription')).toBe('button');
  });

  it('clears triangle text React restores into an existing CSS chevron span', () => {
    document.body.innerHTML = `
      <details class="data-table-wrapper">
        <summary>
          <span class="chart-summary-chevron" aria-hidden="true">▼</span>
          Chart data table
        </summary>
      </details>
    `;
    sanitizeSummaryControls(document);
    const chevron = document.querySelector('.chart-summary-chevron');
    expect(chevron.textContent).toBe('');
    expect(chevron.classList.contains('chart-summary-chevron')).toBe(true);
  });
});
