import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Layout from '../components/Layout';

describe('Layout landmarks', () => {
  it('renders a single main landmark', () => {
    render(
      <MemoryRouter initialEntries={['/section-1']}>
        <Routes>
          <Route path="/" element={<Layout embed />}>
            <Route path="section-1" element={<div>Page body</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    const mains = screen.getAllByRole('main');
    expect(mains).toHaveLength(1);
    expect(mains[0]).toHaveAttribute('id', 'main-content');
    expect(screen.getByText('Page body')).toBeInTheDocument();
  });

  it('hides GC chrome in embed mode', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/section-1?embed=1']}>
        <Routes>
          <Route path="/" element={<Layout embed />}>
            <Route path="section-1" element={<div>Embed</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(container.querySelector('#wb-bnr')).toBeNull();
    expect(container.querySelector('#sidebar-nav')).toBeNull();
  });
});
