import { describe, it, expect, afterEach } from 'vitest';
import { focusRouteContent, resolveRouteFocusTarget } from './focusRouteContent';

describe('resolveRouteFocusTarget', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('prefers the h1 inside the hashed page wrapper', () => {
    document.body.innerHTML = `
      <main id="main-content" tabindex="-1">
        <div id="energy-overview" class="stacked-page-wrapper">
          <article tabindex="-1"><h1>Energy overview</h1></article>
        </div>
      </main>
    `;
    const target = resolveRouteFocusTarget({ hash: 'energy-overview' });
    expect(target?.tagName).toBe('H1');
    expect(target?.textContent).toBe('Energy overview');
  });

  it('falls back to main when no page content exists', () => {
    document.body.innerHTML = `<main id="main-content" tabindex="-1"></main>`;
    expect(resolveRouteFocusTarget({}).id).toBe('main-content');
  });
});

describe('focusRouteContent', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('moves document focus to the page heading', async () => {
    document.body.innerHTML = `
      <a id="nav-link" href="#next">Next topic</a>
      <main id="main-content" tabindex="-1">
        <div id="next-topic" class="stacked-page-wrapper">
          <article tabindex="-1"><h1>Next topic title</h1></article>
        </div>
      </main>
    `;
    document.getElementById('nav-link').focus();
    expect(document.activeElement?.id).toBe('nav-link');

    await new Promise((resolve) => {
      const cancel = focusRouteContent({
        hash: 'next-topic',
        onFocused: () => {
          cancel();
          resolve();
        },
      });
    });

    expect(document.activeElement?.tagName).toBe('H1');
    expect(document.activeElement?.textContent).toBe('Next topic title');
  });
});
