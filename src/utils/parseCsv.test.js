import { describe, it, expect } from 'vitest';
import { parseCSV } from './parseCsv.js';

describe('parseCSV', () => {
  it('parses headers and numeric values', () => {
    const csv = `year,value,name
2020,42.5,Canada
2021,100,Test`;
    const rows = parseCSV(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ year: 2020, value: 42.5, name: 'Canada' });
    expect(rows[1].value).toBe(100);
  });

  it('handles quoted fields with commas', () => {
    const csv = `label,amount
"Oil, gas",12`;
    const rows = parseCSV(csv);
    expect(rows[0].label).toBe('Oil, gas');
    expect(rows[0].amount).toBe(12);
  });

  it('returns empty array for empty input', () => {
    expect(parseCSV('')).toEqual([]);
  });
});
