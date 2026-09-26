import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { downloadChartPng } from './downloadChartPng';

describe('downloadChartPng', () => {
  beforeEach(() => {
    vi.stubGlobal('Plotly', {
      toImage: vi.fn(async () => 'data:image/png;base64,aaaa'),
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('no-ops without a plot element', async () => {
    await expect(downloadChartPng(null, { filename: 'x.png' })).resolves.toBeUndefined();
    expect(window.Plotly.toImage).not.toHaveBeenCalled();
  });

  it('requests a png from Plotly when a plot element is provided', async () => {
    // fetch/canvas path may throw in jsdom; ensure Plotly.toImage is still invoked
    const el = document.createElement('div');
    try {
      await downloadChartPng(el, { filename: 'chart.png' });
    } catch {
      // jsdom may lack full canvas/blob support for the non-composite path
    }
    expect(window.Plotly.toImage).toHaveBeenCalled();
  });
});
