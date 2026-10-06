import { describe, it, expect } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import React, { useState } from 'react';
import ChartDataTable from '../components/ChartDataTable';

/**
 * Smoke: native details/summary; table cells exposed; no hollow region host.
 */
function ChartDataTableFixture() {
  const [isTableOpen, setIsTableOpen] = useState(false);
  return (
    <div className="fixture-table-wrapper">
      <details onToggle={(e) => setIsTableOpen(e.currentTarget.open)}>
        <summary>
          <span aria-hidden="true">{isTableOpen ? '▼' : '▶'}</span>
          Chart data table
          <span className="wb-inv"> Press Enter to open or close.</span>
        </summary>
        <div className="table-responsive">
          <table>
            <caption className="wb-inv">Primary energy production by region</caption>
            <thead>
              <tr>
                <th scope="col">Region</th>
                <th scope="col">Coal</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Alta.</th>
                <td>380</td>
              </tr>
              <tr>
                <th scope="row">Ont.</th>
                <td>12</td>
              </tr>
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

describe('chart data table screenreader pattern', () => {
  it('uses native summary without role=button', () => {
    const { container } = render(<ChartDataTableFixture />);
    const summary = container.querySelector('summary');
    expect(summary).toBeTruthy();
    expect(summary.getAttribute('role')).toBeNull();
  });

  it('exposes table headers and data cells when details is opened', () => {
    const { container } = render(<ChartDataTableFixture />);
    fireEvent.click(container.querySelector('summary'));

    const table = screen.getByRole('table');
    expect(within(table).getByRole('columnheader', { name: 'Region' })).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: 'Coal' })).toBeInTheDocument();
    expect(within(table).getByRole('rowheader', { name: 'Alta.' })).toBeInTheDocument();
    expect(within(table).getByRole('cell', { name: '380' })).toBeInTheDocument();
    expect(within(table).getByRole('rowheader', { name: 'Ont.' })).toBeInTheDocument();
    expect(within(table).getByRole('cell', { name: '12' })).toBeInTheDocument();
  });

  it('does not wrap the scroll host in a focusable region landmark', () => {
    const { container } = render(<ChartDataTableFixture />);
    const host = container.querySelector('.table-responsive');
    expect(host.getAttribute('role')).toBeNull();
    expect(host.getAttribute('tabindex')).toBeNull();
  });

  it('does not expose a group stop between the chart data table button and the cells', () => {
    const { container } = render(
      <ChartDataTable
        columns={['Year', 'Source', 'Petajoules', 'Share (%)']}
        rows={[['2023', 'Natural gas', '4884', '40']]}
        tableAriaLabel="Canada's total energy supply"
        caption="Canada's total energy supply"
        defaultOpen
      />,
    );

    const scrollTop = container.querySelector('.table-scroll-top');
    const host = container.querySelector('.table-responsive');
    const table = container.querySelector('table');
    expect(scrollTop.getAttribute('tabindex')).toBe('-1');
    expect(scrollTop.getAttribute('aria-hidden')).toBe('true');
    expect(host.getAttribute('aria-label')).toBeNull();
    expect(host.getAttribute('role')).toBeNull();
    expect(host.getAttribute('tabindex')).toBe('-1');
    expect(table.getAttribute('aria-label')).toBe("Canada's total energy supply");
  });
});
