import { describe, it, expect } from 'vitest';
import {
  DEFAULT_INTERACTIVE_CONFIG,
  DEFAULT_INTERACTIVE_LAYOUT,
  PLOTLY_MODEBAR_BUTTONS_TO_REMOVE,
  mergePlotConfig,
  mergePlotLayout,
} from './plotlyInteractiveDefaults';

describe('mergePlotLayout', () => {
  it('applies default dragmode and clickmode', () => {
    expect(mergePlotLayout()).toEqual(DEFAULT_INTERACTIVE_LAYOUT);
  });

  it('allows page-specific layout fields', () => {
    expect(mergePlotLayout({ barmode: 'stack', margin: { l: 40 } })).toEqual({
      ...DEFAULT_INTERACTIVE_LAYOUT,
      barmode: 'stack',
      margin: { l: 40 },
    });
  });

  it('always disables drag so charts stay click-to-select', () => {
    expect(mergePlotLayout({ dragmode: 'pan' })).toEqual({
      ...DEFAULT_INTERACTIVE_LAYOUT,
      dragmode: false,
    });
    expect(mergePlotLayout({ dragmode: 'zoom' }).dragmode).toBe(false);
  });
});

describe('mergePlotConfig', () => {
  it('applies default scrollZoom and doubleClick', () => {
    expect(mergePlotConfig()).toEqual(DEFAULT_INTERACTIVE_CONFIG);
  });

  it('allows page-specific config fields', () => {
    expect(mergePlotConfig({ displayModeBar: true, responsive: true })).toEqual({
      ...DEFAULT_INTERACTIVE_CONFIG,
      displayModeBar: true,
      responsive: true,
    });
  });

  it('allows explicit page overrides when needed', () => {
    expect(mergePlotConfig({ doubleClick: 'reset' })).toEqual({
      ...DEFAULT_INTERACTIVE_CONFIG,
      doubleClick: 'reset',
    });
  });

  it('always unions modeBarButtonsToRemove with the full PNG-only list', () => {
    const merged = mergePlotConfig({
      modeBarButtonsToRemove: ['toImage', 'select2d', 'lasso2d'],
    });
    expect(merged.displaylogo).toBe(false);
    expect(merged.modeBarButtonsToRemove).toEqual(
      expect.arrayContaining([...PLOTLY_MODEBAR_BUTTONS_TO_REMOVE]),
    );
    expect(merged.modeBarButtonsToRemove).toContain('zoom2d');
    expect(merged.modeBarButtonsToRemove).toContain('pan2d');
  });
});
