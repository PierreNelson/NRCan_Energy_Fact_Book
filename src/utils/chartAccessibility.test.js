import { describe, it, expect } from 'vitest';
import { isDownloadModebarButton, setupPlotlyModebarA11y } from './chartAccessibility';

describe('isDownloadModebarButton', () => {
  it('detects English and French download titles', () => {
    const en = document.createElement('a');
    en.setAttribute('data-title', 'Download chart as PNG');
    expect(isDownloadModebarButton(en)).toBe(true);

    const fr = document.createElement('a');
    fr.setAttribute('data-title', 'Télécharger le graphique en PNG');
    expect(isDownloadModebarButton(fr)).toBe(true);
  });

  it('ignores unrelated modebar buttons', () => {
    const btn = document.createElement('a');
    btn.setAttribute('data-title', 'Zoom');
    expect(isDownloadModebarButton(btn)).toBe(false);
  });
});

describe('setupPlotlyModebarA11y', () => {
  it('labels download and hides other modebar buttons', () => {
    const root = document.createElement('div');
    root.innerHTML = `
      <div class="svg-container"><svg class="main-svg"></svg></div>
      <div class="modebar">
        <a class="modebar-btn" data-title="Zoom"></a>
        <a class="modebar-btn" data-title="Download chart as PNG"></a>
      </div>
    `;
    setupPlotlyModebarA11y(root, { downloadLabel: 'Download chart as PNG' });

    const svg = root.querySelector('svg');
    const zoom = root.querySelector('[data-title="Zoom"]');
    const download = root.querySelector('[data-title="Download chart as PNG"]');

    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(zoom.getAttribute('aria-hidden')).toBe('true');
    expect(zoom.getAttribute('tabindex')).toBe('-1');
    expect(zoom.style.display).toBe('none');
    expect(download.getAttribute('aria-label')).toBe('Download chart as PNG');
    expect(download.getAttribute('tabindex')).toBe('0');
    expect(download.getAttribute('aria-hidden')).toBeNull();
    expect(download.style.display).not.toBe('none');
  });
});
