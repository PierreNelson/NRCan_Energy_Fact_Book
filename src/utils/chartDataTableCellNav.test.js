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
  syncYearsInLabel,
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
    expect(parseColumnHeader('Cost ($M)')).toEqual({
      name: 'Cost',
      unitSpoken: 'million dollars',
      unitRaw: '$M',
    });
    expect(speakHeaderLabel('Cost ($M)')).toBe('Cost, million dollars');
    document.documentElement.lang = 'fr';
    expect(parseColumnHeader('Coût (M$)')).toEqual({
      name: 'Coût',
      unitSpoken: 'millions de dollars',
      unitRaw: 'M$',
    });
    document.documentElement.lang = 'en';
    expect(speakHeaderLabel('Prov.')).toBe('Province');
    expect(expandMetricAbbrev('Prov.')).toBe('Province');
    document.documentElement.lang = 'fr';
    expect(parseColumnHeader('2009 (millions $)')).toEqual({
      name: '2009',
      unitSpoken: 'millions de dollars',
      unitRaw: 'millions $',
    });
  });

  it('speaks US$ as the letters U S dollars', () => {
    document.documentElement.lang = 'en';
    expect(parseColumnHeader('Spot contracts (US$/lb U₃O₈)')).toEqual({
      name: 'Spot contracts',
      unitSpoken: 'U S dollars/lb U₃O₈',
      unitRaw: 'US$/lb U₃O₈',
    });
    document.documentElement.lang = 'fr';
    expect(parseColumnHeader('Contrats au comptant ($ US/lb de U₃O₈)')).toEqual({
      name: 'Contrats au comptant',
      unitSpoken: 'dollars U S/lb de U₃O₈',
      unitRaw: '$ US/lb de U₃O₈',
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

  it('reads a cost ($M) cell as the value then million dollars', () => {
    document.documentElement.lang = 'en';
    document.body.innerHTML = `
      <table>
        <thead>
          <tr><th>Project Name</th><th>Cost ($M)</th></tr>
        </thead>
        <tbody>
          <tr><th scope="row">AOSP Jackpine</th><td>12,000.00</td></tr>
        </tbody>
      </table>
    `;
    const table = document.querySelector('table');
    const headers = columnHeadersFor(table);
    const cell = table.querySelector('tbody td');
    expect(labelForCell(cell, headers, table)).toBe(
      'AOSP Jackpine Cost, 12,000.00 million dollars',
    );
  });

  it('includes year and source when reading petajoules or share cells', () => {
    document.documentElement.lang = 'en';
    document.body.innerHTML = `
      <table>
        <thead>
          <tr><th>Year</th><th>Source</th><th>Petajoules</th><th>Share (%)</th></tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">2023</th>
            <td>Natural gas</td>
            <td>4,884</td>
            <td>40%</td>
          </tr>
        </tbody>
      </table>
    `;
    const table = document.querySelector('table');
    const headers = columnHeadersFor(table);
    const row = table.querySelector('tbody tr');
    expect(labelForCell(row.cells[2], headers)).toBe('Petajoules, 2023, Natural gas, 4,884');
    expect(labelForCell(row.cells[3], headers)).toBe('Share, 2023, Natural gas, 40%');
  });

  it('includes year and region when reading companies or share cells', () => {
    document.documentElement.lang = 'en';
    document.body.innerHTML = `
      <table>
        <thead>
          <tr><th>Year</th><th>Region</th><th>Companies</th><th>Share (%)</th></tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">2025</th>
            <td>Ontario</td>
            <td>1,133</td>
            <td>34.7%</td>
          </tr>
        </tbody>
      </table>
    `;
    const table = document.querySelector('table');
    const headers = columnHeadersFor(table);
    const row = table.querySelector('tbody tr');
    expect(labelForCell(row.cells[2], headers)).toBe('Companies, 2025, Ontario, 1,133');
    expect(labelForCell(row.cells[3], headers)).toBe('Share, 2025, Ontario, 34.7%');
  });

  it('includes year and industry when reading companies or share cells', () => {
    document.documentElement.lang = 'en';
    document.body.innerHTML = `
      <table>
        <thead>
          <tr><th>Year</th><th>Industry</th><th>Companies</th><th>Share (%)</th></tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">2025</th>
            <td>Renewable energy</td>
            <td>744</td>
            <td>22.8%</td>
          </tr>
        </tbody>
      </table>
    `;
    const table = document.querySelector('table');
    const headers = columnHeadersFor(table);
    const row = table.querySelector('tbody tr');
    expect(labelForCell(row.cells[2], headers)).toBe('Companies, 2025, Renewable energy, 744');
    expect(labelForCell(row.cells[3], headers)).toBe('Share, 2025, Renewable energy, 22.8%');
  });

  it('speaks terawatt hours for electricity trade cells instead of ranking', () => {
    document.documentElement.lang = 'en';
    document.body.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Year</th>
            <th>Exports (Terawatt hours)</th>
            <th>Imports (Terawatt hours)</th>
            <th>Net trade (Terawatt hours)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">2025</th>
            <td>31.6</td>
            <td>25.2</td>
            <td>6.4</td>
          </tr>
        </tbody>
      </table>
    `;
    const table = document.querySelector('table');
    const headers = columnHeadersFor(table);
    const row = table.querySelector('tbody tr');
    expect(labelForCell(row.cells[1], headers, table)).toBe('Exports, 2025, 31.6 Terawatt hours');
    expect(labelForCell(row.cells[2], headers, table)).toBe('Imports, 2025, 25.2 Terawatt hours');
    expect(labelForCell(row.cells[3], headers, table)).toBe('Net trade, 2025, 6.4 Terawatt hours');
  });

  it('includes energy source with province cells and year, source, and province with share cells', () => {
    document.documentElement.lang = 'en';
    document.body.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Year</th>
            <th>Energy source</th>
            <th>Province or territory</th>
            <th>Share of generation (%)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">2024</th>
            <td>Hydro</td>
            <td>N.L.</td>
            <td>96.7%</td>
          </tr>
        </tbody>
      </table>
    `;
    const table = document.querySelector('table');
    const headers = columnHeadersFor(table);
    const row = table.querySelector('tbody tr');
    expect(labelForCell(row.cells[2], headers)).toBe('Province or territory, 2024, Hydro, N.L.');
    expect(labelForCell(row.cells[3], headers)).toBe('Share of generation, 2024, Hydro, N.L., 96.7%');
  });

  it('includes the caption year, energy source, and province on a provincial share cell', () => {
    document.documentElement.lang = 'en';
    document.body.innerHTML = `
      <table>
        <caption>Provincial electricity generation by source, 2024</caption>
        <thead>
          <tr>
            <th>Energy source</th>
            <th>Province or territory</th>
            <th>Share of provincial generation (%)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">Biomass</th>
            <td>B.C.</td>
            <td>6.6%</td>
          </tr>
        </tbody>
      </table>
    `;
    const table = document.querySelector('table');
    const headers = columnHeadersFor(table);
    const row = table.querySelector('tbody tr');
    expect(labelForCell(row.cells[2], headers, table)).toBe('Share of provincial generation, 2024, Biomass, B.C., 6.6%');
  });

  it('includes the year and province or region with energy use and share cells', () => {
    document.documentElement.lang = 'en';
    document.body.innerHTML = `
      <table>
        <caption>Electrical energy use by province, 2023</caption>
        <thead>
          <tr>
            <th>Year</th>
            <th>Province or region</th>
            <th>Energy use (PJ)</th>
            <th>Share (%)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">2023</th>
            <td>Atlantic provinces</td>
            <td>130.0</td>
            <td>6.6%</td>
          </tr>
        </tbody>
      </table>
    `;
    const table = document.querySelector('table');
    const headers = columnHeadersFor(table);
    const row = table.querySelector('tbody tr');
    expect(labelForCell(row.cells[2], headers, table)).toBe('Energy use, 2023, Atlantic provinces, 130.0 petajoules');
    expect(labelForCell(row.cells[3], headers, table)).toBe('Share, 2023, Atlantic provinces, 6.6%');
  });

  it('includes the year and sector with energy use and share cells', () => {
    document.documentElement.lang = 'en';
    document.body.innerHTML = `
      <table>
        <caption>Total electrical energy use by sector, 2023</caption>
        <thead>
          <tr>
            <th>Sector</th>
            <th>Energy use (PJ)</th>
            <th>% of the total</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">Residential</th>
            <td>734.2</td>
            <td>37.3%</td>
          </tr>
        </tbody>
      </table>
    `;
    const table = document.querySelector('table');
    const headers = columnHeadersFor(table);
    const row = table.querySelector('tbody tr');
    expect(labelForCell(row.cells[1], headers, table)).toBe('Energy use, 2023, Residential, 734.2 petajoules');
    expect(labelForCell(row.cells[2], headers, table)).toBe('% of the total, 2023, Residential, 37.3%');
  });

  it('includes the caption year and category with share and megatonne cells', () => {
    document.documentElement.lang = 'en';
    document.body.innerHTML = `
      <table>
        <caption>Global hydrogen production by energy source, 2024</caption>
        <thead>
          <tr>
            <th>Category</th>
            <th>Share (%)</th>
            <th>Mt</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">By-product</th>
            <td>15%</td>
            <td>15</td>
          </tr>
        </tbody>
      </table>
    `;
    const table = document.querySelector('table');
    const headers = columnHeadersFor(table);
    const row = table.querySelector('tbody tr');
    expect(labelForCell(row.cells[1], headers, table)).toBe('Share, 2024, By-product, 15%');
    expect(labelForCell(row.cells[2], headers, table)).toBe('Megatonnes, 2024, By-product, 15');
  });

  it('includes the charger type with a share cell', () => {
    document.documentElement.lang = 'en';
    document.body.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Year</th>
            <th>Charger type</th>
            <th>Share (%)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">2026</th>
            <td>AC Level 2</td>
            <td>78.3%</td>
          </tr>
        </tbody>
      </table>
    `;
    const table = document.querySelector('table');
    const headers = columnHeadersFor(table);
    const row = table.querySelector('tbody tr');
    expect(labelForCell(row.cells[2], headers, table)).toBe('Share, 2026, AC Level 2, 78.3%');
  });

  it('includes the country with reserves and share cells, and speaks billion barrels', () => {
    document.documentElement.lang = 'en';
    document.body.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Year</th>
            <th>Country or region</th>
            <th>Reserves (Bb)</th>
            <th>Share (%)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">2023</th>
            <td>Venezuela</td>
            <td>303</td>
            <td>17%</td>
          </tr>
        </tbody>
      </table>
    `;
    const table = document.querySelector('table');
    const headers = columnHeadersFor(table);
    const row = table.querySelector('tbody tr');
    expect(labelForCell(row.cells[2], headers, table)).toBe('Reserves, 2023, Venezuela, 303 billion barrels');
    expect(labelForCell(row.cells[3], headers, table)).toBe('Share, 2023, Venezuela, 17%');
  });

  it('speaks oil-by-rail volumes in thousand barrels per day instead of ranking', () => {
    document.documentElement.lang = 'en';
    document.body.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Period</th>
            <th>Exports (Mb/d)</th>
            <th>Domestic shipments (Mb/d)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">2014 Q1</th>
            <td>48</td>
            <td>95</td>
          </tr>
        </tbody>
      </table>
    `;
    const table = document.querySelector('table');
    const headers = columnHeadersFor(table);
    const row = table.querySelector('tbody tr');
    expect(labelForCell(row.cells[1], headers, table)).toBe('Exports, 2014 Q1, 48 thousand barrels per day');
    expect(labelForCell(row.cells[2], headers, table)).toBe('Domestic shipments, 2014 Q1, 95 thousand barrels per day');
  });

  it('includes the caption year and region, and the indicator, with barrel volumes', () => {
    document.documentElement.lang = 'en';
    document.body.innerHTML = `
      <table>
        <caption>Direct and indirect petroleum employment by region, 2024</caption>
        <thead>
          <tr>
            <th>Region</th>
            <th>Direct employment (%)</th>
            <th>Indirect employment (%)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">B.C.</th>
            <td>5 percent</td>
            <td>11 percent</td>
          </tr>
        </tbody>
      </table>
      <table id="supply">
        <caption>Canadian supply and demand infographic, 2024</caption>
        <thead>
          <tr>
            <th>Indicator</th>
            <th>Value (MMb/d)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">Canadian production</th>
            <td>5.1</td>
          </tr>
        </tbody>
      </table>
    `;
    const regionTable = document.querySelector('table');
    const regionHeaders = columnHeadersFor(regionTable);
    const regionRow = regionTable.querySelector('tbody tr');
    expect(labelForCell(regionRow.cells[1], regionHeaders, regionTable)).toBe('Direct employment, 2024, B.C., 5 percent');
    const supplyTable = document.getElementById('supply');
    const supplyHeaders = columnHeadersFor(supplyTable);
    const supplyRow = supplyTable.querySelector('tbody tr');
    expect(labelForCell(supplyRow.cells[1], supplyHeaders, supplyTable)).toBe('Value, 2024, Canadian production, 5.1 million barrels per day');
  });

  it('speaks refinery capacity with the province and caption year, not as reserves', () => {
    document.documentElement.lang = 'en';
    document.body.innerHTML = `
      <table>
        <caption>Canadian petroleum refineries by count and capacity, capacities in Mb/d, 2024.</caption>
        <thead>
          <tr>
            <th>Province</th>
            <th>Petroleum refinery Count</th>
            <th>Petroleum refinery Capacity</th>
            <th>MMb/d</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">Alberta</th>
            <td>4</td>
            <td>549</td>
            <td>2.0</td>
          </tr>
        </tbody>
      </table>
    `;
    const table = document.querySelector('table');
    const headers = columnHeadersFor(table);
    const row = table.querySelector('tbody tr');
    expect(labelForCell(row.cells[1], headers, table)).toBe('Petroleum refinery Count, 2024, Alberta, 4');
    expect(labelForCell(row.cells[2], headers, table)).toBe('Petroleum refinery Capacity, 2024, Alberta, 549');
    expect(labelForCell(row.cells[3], headers, table)).toBe('Million barrels per day, 2024, Alberta, 2.0');
  });

  it('speaks coal trade in megatonnes instead of ranking', () => {
    document.documentElement.lang = 'en';
    document.body.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Year</th>
            <th>Exports (Mt)</th>
            <th>Imports (Mt)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">2025</th>
            <td>37</td>
            <td>5</td>
          </tr>
        </tbody>
      </table>
    `;
    const table = document.querySelector('table');
    const headers = columnHeadersFor(table);
    const row = table.querySelector('tbody tr');
    expect(labelForCell(row.cells[1], headers, table)).toBe('Exports, 2025, 37 megatonnes');
    expect(labelForCell(row.cells[2], headers, table)).toBe('Imports, 2025, 5 megatonnes');
  });

  it('includes the caption year and city, and speaks cents per kilowatt hour', () => {
    document.documentElement.lang = 'en';
    document.body.innerHTML = `
      <table>
        <caption>Average large industrial and residential electricity prices by city, 2025</caption>
        <thead>
          <tr>
            <th>City</th>
            <th>Industrial (cents/kWh)</th>
            <th>Residential (cents/kWh)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">Vancouver</th>
            <td>7.06</td>
            <td>13.43</td>
          </tr>
        </tbody>
      </table>
    `;
    const table = document.querySelector('table');
    const headers = columnHeadersFor(table);
    const row = table.querySelector('tbody tr');
    expect(labelForCell(row.cells[1], headers, table)).toBe('Industrial, 2025, Vancouver, 7.06 cents per kilowatt hour');
    expect(labelForCell(row.cells[2], headers, table)).toBe('Residential, 2025, Vancouver, 13.43 cents per kilowatt hour');
  });

  it('includes the rank and country on a hydro share cell, and speaks facility capacity in megawatts', () => {
    document.documentElement.lang = 'en';
    document.body.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Rank</th>
            <th>Country</th>
            <th>Share (%)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">1</th>
            <td>China</td>
            <td>29%</td>
          </tr>
        </tbody>
      </table>
      <table id="facilities">
        <caption>Major hydro facilities in Canada (≥1,000 MW), 2024</caption>
        <thead>
          <tr>
            <th>Facility</th>
            <th>Total capacity (MW)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">Robert-Bourassa</th>
            <td>5,616</td>
          </tr>
        </tbody>
      </table>
    `;
    const hydro = document.querySelector('table');
    const hydroHeaders = columnHeadersFor(hydro);
    const hydroRow = hydro.querySelector('tbody tr');
    expect(labelForCell(hydroRow.cells[2], hydroHeaders, hydro)).toBe('Share, Rank 1, China, 29%');
    const facilities = document.getElementById('facilities');
    const facilityHeaders = columnHeadersFor(facilities);
    const facilityRow = facilities.querySelector('tbody tr');
    expect(labelForCell(facilityRow.cells[1], facilityHeaders, facilities)).toBe('Total capacity, 2024, Robert-Bourassa, 5,616 megawatts');
  });

  it('includes year and state, and speaks C$ millions in full, for export cells', () => {
    document.documentElement.lang = 'en';
    document.body.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Year</th>
            <th>State</th>
            <th>Exports (C$ millions)</th>
            <th>% of nominal state GDP</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">2024</th>
            <td>Illinois</td>
            <td>69,670</td>
            <td>7.2%</td>
          </tr>
        </tbody>
      </table>
    `;
    const table = document.querySelector('table');
    const headers = columnHeadersFor(table);
    const row = table.querySelector('tbody tr');
    expect(labelForCell(row.cells[2], headers, table)).toBe(
      'Exports, 2024, Illinois, 69,670 millions of Canadian dollars',
    );
    expect(labelForCell(row.cells[3], headers, table)).toBe(
      '% of nominal state GDP, 2024, Illinois, 7.2%',
    );
  });

  it('includes year and category when reading exports or imports', () => {
    document.documentElement.lang = 'en';
    document.body.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Year</th>
            <th>Category</th>
            <th>Exports (billions $)</th>
            <th>Imports (billions $)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">2024</th>
            <td>Crude oil</td>
            <td>99.84</td>
            <td>11.2</td>
          </tr>
        </tbody>
      </table>
    `;
    const table = document.querySelector('table');
    const headers = columnHeadersFor(table);
    const row = table.querySelector('tbody tr');
    expect(labelForCell(row.cells[2], headers, table)).toBe(
      'Exports, 2024, Crude oil, 99.84 billions of dollars',
    );
    expect(labelForCell(row.cells[3], headers, table)).toBe(
      'Imports, 2024, Crude oil, 11.2 billions of dollars',
    );
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

  it('speaks ktU once and billions of dollars once when the cell already names the scale', () => {
    document.documentElement.lang = 'en';
    document.body.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Year</th>
            <th>Canadian production (ktU)</th>
            <th>Value ($ billion)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">2024</th>
            <td>14.3 ktU</td>
            <td>$3 billion</td>
          </tr>
        </tbody>
      </table>
    `;
    const table = document.querySelector('table');
    const headers = columnHeadersFor(table);
    const cells = table.querySelectorAll('tbody td');
    expect(labelForCell(cells[0], headers)).toBe('Canadian production, 2024, 14.3 ktU');
    expect(labelForCell(cells[1], headers)).toBe('Value, 2024, 3 billions of dollars');
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
    expect(title.getAttribute('aria-label')).toBeNull();
    expect(title.textContent).toMatch(/Global energy rankings/);
    expect(document.querySelector('.chart-table-colheaders')).toBeNull();
  });

  it('updates the chart title accessible name when the selected year changes', () => {
    document.body.innerHTML = `
      <article>
        <h2 class="environmental-protection-chart-title">Oil and gas extraction expenditures per environmental activity (2023, $ millions)</h2>
        <div class="table-responsive">
          <table>
            <caption class="wb-inv">Oil and gas extraction expenditures</caption>
            <thead><tr><th>Year</th><th>Air</th></tr></thead>
            <tbody><tr><th scope="row">2023</th><td>10</td></tr></tbody>
          </table>
        </div>
      </article>
    `;
    const table = document.querySelector('table');
    const title = document.querySelector('h2');
    enhanceTable(table);
    expect(title.getAttribute('aria-label')).toBeNull();

    title.setAttribute(
      'aria-label',
      'Oil and gas extraction expenditures per environmental activity (2023, $ millions)',
    );
    title.textContent = 'Oil and gas extraction expenditures per environmental activity (2021, $ millions)';
    enhanceTable(table);
    expect(title.getAttribute('aria-label')).toBeNull();
    expect(title.textContent).toContain('2021');
    expect(title.textContent).not.toMatch(/\b2023\b/);
  });

  it('replaces a title snapshot when the selected year changes the total and the year', () => {
    document.body.innerHTML = `
      <article>
        <h3 class="electricity-international-context-graphic-title">World production – 30,350 TWh (2024)</h3>
        <div class="table-responsive">
          <table>
            <thead><tr><th>Year</th><th>Total</th></tr></thead>
            <tbody><tr><th scope="row">2024</th><td>30,350</td></tr></tbody>
          </table>
        </div>
      </article>
    `;
    const table = document.querySelector('table');
    const title = document.querySelector('h3');
    title.setAttribute('aria-label', 'World production – 30,350 TWh (2024)');
    enhanceTable(table);
    expect(title.getAttribute('aria-label')).toBeNull();

    title.setAttribute('aria-label', 'World production – 30,350 TWh (2024)');
    title.textContent = 'World production – 29,200 TWh (2021)';
    enhanceTable(table);
    expect(title.getAttribute('aria-label')).toBeNull();
    expect(title.textContent).toBe('World production – 29,200 TWh (2021)');
  });

  it('does not replace an exposed chart title with another table caption', () => {
    document.body.innerHTML = `
      <article>
        <h3 class="electricity-international-context-graphic-title">World production – 29,200 TWh (2021)</h3>
        <div class="table-responsive">
          <table>
            <caption class="wb-inv">World electricity production by year.</caption>
            <thead><tr><th>Year</th><th>Total</th></tr></thead>
            <tbody><tr><th scope="row">2021</th><td>29,200</td></tr></tbody>
          </table>
        </div>
        <h3 class="electricity-international-context-graphic-title">World exports – 795 TWh (2021)</h3>
        <div class="table-responsive">
          <table>
            <caption class="wb-inv">World electricity exports: total and top five countries' share of world total by year.</caption>
            <thead><tr><th>Year</th><th>Total</th></tr></thead>
            <tbody><tr><th scope="row">2021</th><td>795</td></tr></tbody>
          </table>
        </div>
      </article>
    `;
    document.querySelectorAll('table').forEach((table) => enhanceTable(table));
    const [production, exportsTitle] = document.querySelectorAll('h3');
    expect(production.getAttribute('aria-label')).toBeNull();
    expect(production.textContent).toBe('World production – 29,200 TWh (2021)');
    expect(exportsTitle.getAttribute('aria-label')).toBeNull();
    expect(exportsTitle.textContent).toBe('World exports – 795 TWh (2021)');
  });

  it('updates a graphic title year that is visually shown but hidden from the accessible name', () => {
    document.body.innerHTML = `
      <article>
        <h3 class="crude-oil-international-graphic-title">
          <span aria-hidden="true">Proved reserves – 1,200 (2023)</span>
        </h3>
        <div class="table-responsive">
          <table>
            <thead><tr><th>Rank</th><th>Country</th></tr></thead>
            <tbody><tr><th scope="row">1</th><td>Canada</td></tr></tbody>
          </table>
        </div>
      </article>
    `;
    const title = document.querySelector('h3');
    enhanceTable(document.querySelector('table'));
    expect(title.getAttribute('aria-label')).toContain('2023');
    title.querySelector('span').textContent = 'Proved reserves – 1,200 (2021)';
    enhanceTable(document.querySelector('table'));
    expect(title.getAttribute('aria-label')).toContain('2021');
    expect(title.getAttribute('aria-label')).not.toMatch(/\b2023\b/);
  });

  it('leaves a spoken chart label that has no year unchanged', () => {
    document.body.innerHTML = `
      <article>
        <h2 class="gdp-chart-chart-title" aria-label="Energy sector GDP, billions of dollars">
          <span aria-hidden="true">Energy sector GDP (2018-2024)</span>
        </h2>
        <div class="table-responsive">
          <table>
            <thead><tr><th>Year</th><th>Total</th></tr></thead>
            <tbody><tr><th scope="row">2024</th><td>1</td></tr></tbody>
          </table>
        </div>
      </article>
    `;
    enhanceTable(document.querySelector('table'));
    expect(document.querySelector('h2').getAttribute('aria-label')).toBe(
      'Energy sector GDP, billions of dollars',
    );
  });

  it('syncYearsInLabel replaces the same number of years and ignores mismatched counts', () => {
    expect(syncYearsInLabel('Activity (2023, $ millions)', 'Activity (2021, $ millions)'))
      .toBe('Activity (2021, $ millions)');
    expect(syncYearsInLabel('Rankings, 2019-2023', 'Rankings, 2018-2022'))
      .toBe('Rankings, 2018-2022');
    expect(syncYearsInLabel('Pie chart for 2023. Total in 2023.', 'Title (2021)'))
      .toBe('Pie chart for 2023. Total in 2023.');
    expect(syncYearsInLabel('Energy sector GDP, billions of dollars', 'Energy sector GDP (2021)'))
      .toBe('Energy sector GDP, billions of dollars');
  });

  it('does not focus a visually hidden heading as the table title', () => {
    document.body.innerHTML = `
      <article>
        <h3 class="wb-inv">Filter area - Use the controls below to filter the projects table</h3>
        <div class="table-responsive">
          <table>
            <caption class="wb-inv">Major energy projects</caption>
            <thead><tr><th>Project</th><th>Prov.</th></tr></thead>
            <tbody><tr><th scope="row">Line</th><td>AB</td></tr></tbody>
          </table>
        </div>
      </article>
    `;
    enhanceTable(document.querySelector('table'));

    const hidden = document.querySelector('h3.wb-inv');
    expect(hidden.getAttribute('tabindex')).toBeNull();
  });

  it('does not leave a focusable group between the disclosure and the first cell', () => {
    document.body.innerHTML = `
      <details open class="data-table-wrapper">
        <summary>Chart data table</summary>
        <div class="table-scroll-top"></div>
        <div class="table-responsive" role="group" aria-label="Canada's total energy supply" tabindex="0">
          <table>
            <caption class="wb-inv">Canada's total energy supply</caption>
            <thead>
              <tr><th>Year</th><th>Source</th><th>Petajoules</th><th>Share (%)</th></tr>
            </thead>
            <tbody>
              <tr><th scope="row">2023</th><td>Natural gas</td><td>4,884</td><td>40%</td></tr>
            </tbody>
          </table>
        </div>
      </details>
    `;
    enhanceTable(document.querySelector('table'));

    const scrollTop = document.querySelector('.table-scroll-top');
    const host = document.querySelector('.table-responsive');
    expect(scrollTop.getAttribute('tabindex')).toBe('-1');
    expect(scrollTop.getAttribute('aria-hidden')).toBe('true');
    expect(host.getAttribute('tabindex')).toBe('-1');
    expect(host.getAttribute('aria-label')).toBeNull();
    expect(host.getAttribute('role')).toBeNull();
    expect(document.querySelector('.chart-table-colheaders')).toBeNull();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    host.focus();
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Year, 2023');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }));
    host.focus();
    expect(document.activeElement?.tagName).toBe('SUMMARY');
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
