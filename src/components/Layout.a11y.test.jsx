import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { MemoryRouter } from 'react-router-dom';
import Layout from '../components/Layout.jsx';

describe('Layout accessibility (axe)', () => {
  it('has no detectable violations in embed content mode', async () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/section-1']}>
        <Layout embed />
      </MemoryRouter>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
