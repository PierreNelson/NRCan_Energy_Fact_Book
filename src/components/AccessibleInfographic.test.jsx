import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import AccessibleInfographic from '../components/AccessibleInfographic';

describe('AccessibleInfographic', () => {
  it('exposes extracted SVG wording for text mode (not only a short title)', () => {
    const markup = '<svg xmlns="http://www.w3.org/2000/svg"><text>Solar capacity 42%</text><text>Wind 18%</text></svg>';
    render(
      <AccessibleInfographic
        mode="text"
        title="Solar PV"
        svgMarkup={markup}
        idPrefix="test-solar"
      />,
    );
    const region = screen.getByRole('region', { name: /Solar PV/i });
    expect(region).toHaveAttribute('tabIndex', '0');
    // Full SVG wording is in the accessible name (labelledby title + body),
    // not only a short aria-describedby that SRs often skip/truncate.
    expect(region.getAttribute('aria-labelledby')).toBe('test-solar-title test-solar-text');
    expect(region).not.toHaveAttribute('aria-describedby');
    expect(document.getElementById('test-solar-text')?.textContent).toMatch(/Solar capacity 42%/);
    expect(document.getElementById('test-solar-text')?.textContent).toMatch(/Wind 18%/);
    expect(screen.getByRole('region', { name: /Solar capacity 42%/i })).toBe(region);
    // Visual SVG is present but hidden from AT
    expect(region.querySelector('.accessible-infographic-svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('keeps informative image mode as focusable img with overview', () => {
    render(
      <AccessibleInfographic
        mode="image"
        title="Clean tech"
        overview="Infographic of clean technology GDP and jobs."
        src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
      />,
    );
    expect(screen.getByRole('img', { name: /GDP and jobs/i })).toHaveAttribute('tabIndex', '0');
  });

  it('hides decorative images from the accessibility tree', () => {
    const { container } = render(
      <AccessibleInfographic
        mode="image"
        decorative
        src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
      />,
    );
    expect(container.querySelector('[aria-hidden="true"]')).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
  });
});
