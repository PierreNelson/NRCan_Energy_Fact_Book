import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Layout from '../components/Layout.jsx';

function ChartPageStub() {
  return (
    <article className="page-content" tabIndex={-1}>
      <h1 id="chart-page-title">Sample chart page</h1>
      <div role="region" aria-label="Sample chart. Values: A 10, B 20." tabIndex={0}>
        <p aria-hidden="true">Chart graphic</p>
      </div>
      <details>
        <summary>Chart data table</summary>
        <table>
          <caption className="wb-inv">Sample data</caption>
          <thead>
            <tr>
              <th scope="col">Category</th>
              <th scope="col">Value</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">A</th>
              <td>10</td>
            </tr>
          </tbody>
        </table>
      </details>
    </article>
  );
}

function InfographicPageStub() {
  return (
    <article className="page-content" tabIndex={-1}>
      <h1 id="infographic-title">Sample infographic</h1>
      <figure role="img" tabIndex={0} aria-label="Infographic summary with full numeric values.">
        <img src="/vite.svg" alt="" aria-hidden="true" />
      </figure>
    </article>
  );
}

function GlossaryStub() {
  return (
    <article className="page-content" tabIndex={-1}>
      <h1 id="glossary-title">Glossary</h1>
      <dl>
        <dt>Energy</dt>
        <dd>Defined term example.</dd>
      </dl>
    </article>
  );
}

describe('Route accessibility smoke (axe)', () => {
  it('section overview route (full FIP) has no detectable violations', async () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/section-1']}>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route path="section-1" element={<ChartPageStub />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('embed chart route has no detectable violations', async () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/section-1?embed=1']}>
        <Routes>
          <Route path="/" element={<Layout embed />}>
            <Route path="section-1" element={<ChartPageStub />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('infographic-style page shell has no detectable violations', async () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/section-6']}>
        <Routes>
          <Route path="/" element={<Layout embed />}>
            <Route path="section-6" element={<InfographicPageStub />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('glossary route has no detectable violations', async () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/Glossary']}>
        <Routes>
          <Route path="/" element={<Layout embed />}>
            <Route path="Glossary" element={<GlossaryStub />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
