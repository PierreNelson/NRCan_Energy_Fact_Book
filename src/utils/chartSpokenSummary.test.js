import { describe, it, expect } from 'vitest';
import { summarizeByCategory, joinChartSummary } from './chartSpokenSummary';

describe('summarizeByCategory', () => {
  it('lists every year and series like a pie lists every slice', () => {
    const body = summarizeByCategory({
      categories: [2018, 2019],
      series: [
        { name: 'Direct', values: [10, 11] },
        { name: 'Indirect', values: [20, 21] },
      ],
      lang: 'en',
    });
    expect(body).toBe('In 2018, Direct: 10; Indirect: 20. In 2019, Direct: 11; Indirect: 21');
  });

  it('uses French In-word and separators', () => {
    const body = summarizeByCategory({
      categories: [2020],
      series: [{ name: 'Direct', values: [5], format: (v) => `${v} k` }],
      lang: 'fr',
    });
    expect(body).toBe('En 2020, Direct: 5 k');
  });
});

describe('joinChartSummary', () => {
  it('joins intro, unit, and body', () => {
    expect(
      joinChartSummary({
        intro: 'Stacked bar chart from 2018 to 2024',
        unitNote: 'Values in thousand jobs',
        body: 'In 2018, Direct: 10',
      }),
    ).toBe('Stacked bar chart from 2018 to 2024. Values in thousand jobs. In 2018, Direct: 10.');
  });
});
