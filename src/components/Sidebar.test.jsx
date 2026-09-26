import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Sidebar from './Sidebar';

describe('Sidebar', () => {
  it('toggles open with the button (keyboard-first)', () => {
    render(
      <MemoryRouter>
        <Sidebar lang="en" />
      </MemoryRouter>,
    );

    const toggle = screen.getByRole('button', { name: /open navigation menu/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: /close navigation menu/i })).toBeInTheDocument();
  });

  it('opens on toggle focus so keyboard users reach the TOC', () => {
    render(
      <MemoryRouter>
        <Sidebar lang="en" />
      </MemoryRouter>,
    );

    const toggle = screen.getByRole('button', { name: /open navigation menu/i });
    fireEvent.focus(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  it('auto-expands the active section for the current route', () => {
    render(
      <MemoryRouter initialEntries={['/section-2#capital-expenditure']}>
        <Sidebar lang="en" />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /open navigation menu/i }));

    const section2Header = screen.getByRole('button', { name: /section 2/i });
    expect(section2Header).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: /capital expenditure/i })).toBeInTheDocument();
  });

  it('exposes section links in tab order when sidebar is open', () => {
    render(
      <MemoryRouter initialEntries={['/section-1']}>
        <Sidebar lang="en" />
      </MemoryRouter>,
    );

    fireEvent.focus(screen.getByRole('button', { name: /navigation menu/i }));

    const overviewLink = screen.getByRole('link', {
      name: /key energy, economic and environmental indicators/i,
    });
    expect(overviewLink).not.toHaveAttribute('tabindex', '-1');
    overviewLink.focus();
    expect(document.activeElement).toBe(overviewLink);
  });
});
